import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { v4 as uuidv4 } from 'uuid';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

const requestIdPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.requestId = (request.headers['x-request-id'] as string) || uuidv4();
  });

  fastify.addHook('onSend', async (request: FastifyRequest, reply, payload) => {
    reply.header('x-request-id', request.requestId);
    return payload;
  });
};

export default fp(requestIdPlugin);
