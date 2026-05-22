import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  CreateConversationRequestSchema,
  ConversationIdParamsSchema,
  type ConversationIdParams,
  type CreateConversationRequest,
} from '@ollive/shared';
import { validateHook } from '../plugins/validate';
import {
  createConversation,
  listConversations,
  getConversationWithMessages,
} from '../repositories/conversations';

const conversationRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/v1/conversations - create a new conversation
  fastify.post(
    '/',
    {
      preHandler: validateHook({ body: CreateConversationRequestSchema }),
    },
    async (request, reply) => {
      const body = request.validatedBody as CreateConversationRequest;
      const conversation = await createConversation(body.title);

      return reply.status(201).send(conversation);
    }
  );

  // GET /api/v1/conversations - list conversations
  fastify.get('/', async (request, reply) => {
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const conversationList = await listConversations(parsedLimit, parsedOffset);

    return reply.send({
      conversations: conversationList,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: conversationList.length,
      },
    });
  });

  // GET /api/v1/conversations/:id - get conversation with messages
  fastify.get(
    '/:id',
    {
      preHandler: validateHook({ params: ConversationIdParamsSchema }),
    },
    async (request, reply) => {
      const { id } = request.validatedParams as ConversationIdParams;
      const conversation = await getConversationWithMessages(id);

      if (!conversation) {
        const error = new Error('Conversation not found') as Error & { statusCode: number };
        error.statusCode = 404;
        throw error;
      }

      return reply.send(conversation);
    }
  );
};

export default conversationRoutes;
