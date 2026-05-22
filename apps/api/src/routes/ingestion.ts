import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const ingestionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Placeholder for ingestion routes
  // Will be implemented in Chunk 7: Ingestion Pipeline
};

export default fp(ingestionRoutes, { prefix: '/api/v1/ingestion' });
