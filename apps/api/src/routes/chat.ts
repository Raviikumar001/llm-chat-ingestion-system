import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { v4 as uuidv4 } from 'uuid';
import { SendChatRequestSchema, SupportedProvider, UuidSchema } from '@ollive/shared';
import { validateHook } from '../plugins/validate';
import { getConversationById, updateConversationActivity, updateConversationStatus } from '../repositories/conversations';
import {
  createMessage,
  getNextSequenceNumber,
  getRecentMessagesByConversationId,
  updateMessageStatus,
  updateMessageContent,
} from '../repositories/messages';
import { buildPromptContext } from '../services/context-builder';

// Track active requests for cancellation
const activeRequests = new Map<string, AbortController>();

const chatRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/v1/chat - send a message and get assistant response (non-streaming)
  fastify.post(
    '/',
    {
      preHandler: validateHook({ body: SendChatRequestSchema }),
    },
    async (request, reply) => {
      const body = request.validatedBody as {
        conversationId: string;
        message: string;
        provider?: SupportedProvider;
        model?: string;
      };

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
        const provider = requestedProvider || (fastify.llmProvider.name as SupportedProvider);
        const model = requestedModel || fastify.defaultModel;

        // Step 5: Call LLM gateway
        const generateRequest = {
          conversationId,
          userMessageId: userMessage.id,
          model,
          messages: context,
        };

        const result = await fastify.llmProvider.generate(generateRequest);

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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          requestId,
          error: {
            code: 'provider_error',
            message: errorMessage,
          },
        });
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
      const body = request.validatedBody as {
        conversationId: string;
        message: string;
        provider?: SupportedProvider;
        model?: string;
      };

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
      activeRequests.set(requestId, abortController);

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

        const provider = requestedProvider || (fastify.llmProvider.name as SupportedProvider);
        const model = requestedModel || fastify.defaultModel;

        const streamRequest = {
          conversationId,
          userMessageId: userMessage.id,
          model,
          messages: context,
        };

        let fullText = '';

        // Stream chunks
        for await (const chunk of fastify.llmProvider.stream!(streamRequest)) {
          if (abortController.signal.aborted) {
            break;
          }

          fullText += chunk.text;
          reply.raw.write(`data: ${JSON.stringify({ text: chunk.text, finishReason: chunk.finishReason }) }\n\n`);
        }

        // Finalize assistant message
        await updateMessageContent(assistantMessage.id, fullText);
        await updateMessageStatus(assistantMessage.id, 'completed');
        await updateConversationActivity(conversationId, new Date());

        reply.raw.write(`data: ${JSON.stringify({ done: true, messageId: assistantMessage.id }) }\n\n`);
        reply.raw.end();
      } catch (error) {
        await updateMessageStatus(assistantMessage.id, 'failed');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reply.raw.write(`data: ${JSON.stringify({ error: errorMessage }) }\n\n`);
        reply.raw.end();
      } finally {
        activeRequests.delete(requestId);
      }

      return reply;
    }
  );

  // POST /api/v1/conversations/:id/cancel - cancel active inference
  fastify.post(
    '/:id/cancel',
    {
      preHandler: validateHook({ params: UuidSchema }),
    },
    async (request, reply) => {
      const conversationId = request.validatedParams as string;

      // Find and cancel any active request for this conversation
      let cancelled = false;
      for (const [reqId, controller] of activeRequests.entries()) {
        // In a real implementation, we'd key by conversation ID
        // For now, we just cancel the most recent request
        controller.abort();
        activeRequests.delete(reqId);
        cancelled = true;
        break;
      }

      if (cancelled) {
        await updateConversationStatus(conversationId, 'cancelled');
        return reply.send({ status: 'cancelled', conversationId });
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

export default fp(chatRoutes, { prefix: '/api/v1/chat' });
