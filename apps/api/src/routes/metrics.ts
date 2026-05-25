import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getMetricsOverview } from '../services/metrics';

const metricsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/overview', async (_request, reply) => {
    const metrics = await getMetricsOverview();
    return reply.send(metrics);
  });
};

export default metricsRoutes;
