import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const chatRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Placeholder for chat routes
  // Will be implemented in Chunk 6: Chat Flow
};

export default fp(chatRoutes, { prefix: '/api/v1/chat' });
