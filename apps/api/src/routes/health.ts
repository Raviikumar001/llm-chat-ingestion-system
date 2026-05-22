import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { sql } from 'drizzle-orm';

const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.get('/ready', async () => {
    // Check database connectivity
    try {
      const { db } = await import('../db');
      await db.execute(sql`SELECT 1`);
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch {
      const error = new Error('Database not ready') as Error & { statusCode: number };
      error.statusCode = 503;
      throw error;
    }
  });
};

export default fp(healthRoutes);
