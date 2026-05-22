import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { IngestionPayloadSchema, type IngestionPayload } from '@ollive/shared';
import { validateHook } from '../plugins/validate';
import { processIngestionPayload } from '../services/ingestion';

const ingestionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/v1/ingestion/inference-logs
  fastify.post(
    '/inference-logs',
    {
      preHandler: validateHook({ body: IngestionPayloadSchema }),
    },
    async (request, reply) => {
      const body = request.validatedBody as IngestionPayload | undefined;

      if (!body) {
        const error = new Error('Invalid ingestion payload') as Error & { statusCode: number };
        error.statusCode = 400;
        throw error;
      }

      try {
        const result = await processIngestionPayload(body);
        return reply.status(200).send(result);
      } catch (err) {
        request.log.error({ err }, 'Ingestion processing failed');
        const error = new Error('Failed to process ingestion payload') as Error & { statusCode: number };
        error.statusCode = 500;
        throw error;
      }
    }
  );
};

export default ingestionRoutes;
