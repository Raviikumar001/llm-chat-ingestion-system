import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

const loggerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.log.info({
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
    }, 'Incoming request');
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply) => {
    request.log.info({
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, 'Request completed');
  });
};

export default fp(loggerPlugin);
