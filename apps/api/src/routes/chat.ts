import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { v4 as uuidv4 } from 'uuid';
import { SendChatRequestSchema, SupportedProvider } from '@ollive/shared';
import { validateHook } from '../plugins/validate';
import { getConversationById, updateConversationActivity } from '../repositories/conversations';
import {
  createMessage,
  getNextSequenceNumber,
  getRecentMessagesByConversationId,
} from '../repositories/messages';
import { buildPromptContext } from '../services/context-builder';

const chatRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/v1/chat - send a message and get assistant response
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
        // If provider fails, we still have the user message persisted
        // Return a controlled error to the UI
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
};

export default fp(chatRoutes, { prefix: '/api/v1/chat' });
