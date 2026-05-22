import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const conversationRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Placeholder for conversation routes
  // Will be implemented in Chunk 4: Conversation APIs
};

export default fp(conversationRoutes, { prefix: '/api/v1/conversations' });
