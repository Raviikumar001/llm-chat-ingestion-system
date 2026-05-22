import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { v4 as uuidv4 } from 'uuid';
import {
  SendChatRequestSchema,
  ConversationIdParamsSchema,
  type ConversationIdParams,
  type SendChatRequest,
} from '@ollive/shared';
import { validateHook } from '../plugins/validate';
import { getConversationById, updateConversationActivity } from '../repositories/conversations';
import {
  createMessage,
  getNextSequenceNumber,
  getRecentMessagesByConversationId,
  updateMessageStatus,
  updateMessageContent,
} from '../repositories/messages';
import { buildPromptContext } from '../services/context-builder';

interface ActiveRequest {
  requestId: string;
  controller: AbortController;
}

const activeRequests = new Map<string, ActiveRequest>();

function isCancelledError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('cancel');
}

const chatRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/v1/chat - send a message and get assistant response (non-streaming)
  fastify.post(
    '/',
    {
      preHandler: validateHook({ body: SendChatRequestSchema }),
    },
    async (request, reply) => {
      const body = request.validatedBody as SendChatRequest;

      const { conversationId, message, provider: requestedProvider, model: requestedModel } = body;
      const requestId = uuidv4();

      // Step 1: Verify conversation exists
      const conversation = await getConversationById(conversationId);
      if (!conversation) {
        const error = new Error('Conversation not found') as Error & { statusCode: number };
        error.statusCode = 404;
        throw error;
      }

      // Step 2: Persist user message
      const userSequenceNumber = await getNextSequenceNumber(conversationId);
      const userMessage = await createMessage(
        conversationId,
        'user',
        message,
        userSequenceNumber,
        'completed'
      );

      try {
        // Step 3: Load recent context window
        const recentMessages = await getRecentMessagesByConversationId(conversationId, 10);
        const context = buildPromptContext(
          recentMessages.map((m) => ({
            role: m.role,
            content: m.content,
            status: m.status,
          }))
        );

        // Step 4: Determine provider and model
        const provider = requestedProvider || fastify.defaultProvider;
        const model = requestedModel || fastify.defaultModel;
        const llmProvider = fastify.createLlmProvider(provider);
        const abortController = new AbortController();

        activeRequests.set(conversationId, {
          requestId,
          controller: abortController,
        });

        // Step 5: Call LLM gateway
        const generateRequest = {
          requestId,
          conversationId,
          userMessageId: userMessage.id,
          model,
          messages: context,
          signal: abortController.signal,
        };

        const result = await llmProvider.generate(generateRequest);

        // Step 6: Persist assistant message
        const assistantSequenceNumber = await getNextSequenceNumber(conversationId);
        const assistantMessage = await createMessage(
          conversationId,
          'assistant',
          result.text,
          assistantSequenceNumber,
          'completed',
          result.providerMessageId
        );

        // Step 7: Update conversation activity
        await updateConversationActivity(conversationId, new Date());

        // Step 8: Return response
        return reply.send({
          requestId,
          message: assistantMessage,
          metadata: {
            provider,
            model,
            finishReason: result.finishReason,
            usage: result.usage,
          },
        });
      } catch (error) {
        const cancelled = isCancelledError(error);
        const statusCode = cancelled ? 409 : 500;
        const errorCode = cancelled ? 'cancelled' : 'provider_error';
        const errorMessage = cancelled
          ? 'The request was cancelled'
          : error instanceof Error
            ? error.message
            : 'Unknown error';

        return reply.status(statusCode).send({
          requestId,
          error: {
            code: errorCode,
            message: errorMessage,
          },
        });
      } finally {
        const activeRequest = activeRequests.get(conversationId);
        if (activeRequest?.requestId === requestId) {
          activeRequests.delete(conversationId);
        }
      }
    }
  );

  // POST /api/v1/chat/stream - stream assistant output
  fastify.post(
    '/stream',
    {
      preHandler: validateHook({ body: SendChatRequestSchema }),
    },
    async (request, reply) => {
      const body = request.validatedBody as SendChatRequest;

      const { conversationId, message, provider: requestedProvider, model: requestedModel } = body;
      const requestId = uuidv4();

      // Verify conversation exists
      const conversation = await getConversationById(conversationId);
      if (!conversation) {
        const error = new Error('Conversation not found') as Error & { statusCode: number };
        error.statusCode = 404;
        throw error;
      }

      // Persist user message
      const userSequenceNumber = await getNextSequenceNumber(conversationId);
      const userMessage = await createMessage(
        conversationId,
        'user',
        message,
        userSequenceNumber,
        'completed'
      );

      // Create partial assistant message
      const assistantSequenceNumber = await getNextSequenceNumber(conversationId);
      const assistantMessage = await createMessage(
        conversationId,
        'assistant',
        '',
        assistantSequenceNumber,
        'partial'
      );

      // Set up SSE response
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const abortController = new AbortController();
      activeRequests.set(conversationId, {
        requestId,
        controller: abortController,
      });
      let fullText = '';

      try {
        // Load context
        const recentMessages = await getRecentMessagesByConversationId(conversationId, 10);
        const context = buildPromptContext(
          recentMessages.map((m) => ({
            role: m.role,
            content: m.content,
            status: m.status,
          }))
        );

        const provider = requestedProvider || fastify.defaultProvider;
        const model = requestedModel || fastify.defaultModel;
        const llmProvider = fastify.createLlmProvider(provider);

        const streamRequest = {
          requestId,
          conversationId,
          userMessageId: userMessage.id,
          model,
          messages: context,
          signal: abortController.signal,
        };

        // Stream chunks
        for await (const chunk of llmProvider.stream!(streamRequest)) {
          if (abortController.signal.aborted) {
            break;
          }

          fullText += chunk.text;
          reply.raw.write(`data: ${JSON.stringify({ text: chunk.text, finishReason: chunk.finishReason }) }\n\n`);
        }

        if (abortController.signal.aborted) {
          if (fullText) {
            await updateMessageContent(assistantMessage.id, fullText);
          }
          await updateMessageStatus(assistantMessage.id, 'cancelled');
          reply.raw.write(`data: ${JSON.stringify({ cancelled: true, messageId: assistantMessage.id })}\n\n`);
          reply.raw.end();
          return reply;
        }

        // Finalize assistant message
        await updateMessageContent(assistantMessage.id, fullText);
        await updateMessageStatus(assistantMessage.id, 'completed');
        await updateConversationActivity(conversationId, new Date());

        reply.raw.write(`data: ${JSON.stringify({ done: true, messageId: assistantMessage.id }) }\n\n`);
        reply.raw.end();
      } catch (error) {
        const cancelled = abortController.signal.aborted || isCancelledError(error);

        if (fullText) {
          await updateMessageContent(assistantMessage.id, fullText);
        }
        await updateMessageStatus(assistantMessage.id, cancelled ? 'cancelled' : 'failed');

        if (cancelled) {
          reply.raw.write(`data: ${JSON.stringify({ cancelled: true, messageId: assistantMessage.id })}\n\n`);
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          reply.raw.write(`data: ${JSON.stringify({ error: errorMessage }) }\n\n`);
        }
        reply.raw.end();
      } finally {
        const activeRequest = activeRequests.get(conversationId);
        if (activeRequest?.requestId === requestId) {
          activeRequests.delete(conversationId);
        }
      }

      return reply;
    }
  );

  // POST /api/v1/conversations/:id/cancel - cancel active inference
  fastify.post(
    '/:id/cancel',
    {
      preHandler: validateHook({ params: ConversationIdParamsSchema }),
    },
    async (request, reply) => {
      const { id: conversationId } = request.validatedParams as ConversationIdParams;
      const activeRequest = activeRequests.get(conversationId);

      if (activeRequest) {
        activeRequest.controller.abort();
        return reply.send({
          status: 'cancelled',
          conversationId,
          requestId: activeRequest.requestId,
        });
      }

      return reply.status(404).send({
        error: {
          code: 'no_active_request',
          message: 'No active request found for this conversation',
          requestId: request.requestId,
        },
      });
    }
  );
};

export default fp(chatRoutes);
