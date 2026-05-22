import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = (request as any).requestId || 'unknown';

    // Log the error
    request.log.error({
      err: error,
      requestId,
      path: request.url,
      method: request.method,
    }, 'Request error');

    // Zod validation errors
    if (error.name === 'ZodError' || (error as any).issues) {
      const statusCode = 400;
      const response: ApiErrorResponse = {
        error: {
          code: 'validation_error',
          message: `Invalid request: ${(error as any).issues?.[0]?.message || error.message}`,
          requestId,
        },
      };
      return reply.status(statusCode).send(response);
    }

    // Determine status code
    let statusCode = error.statusCode || 500;
    let errorCode = error.code || 'internal_error';
    let message = error.message || 'An internal error occurred';

    // Map known error codes
    if (statusCode >= 500) {
      errorCode = 'internal_error';
      message = 'An internal error occurred';
    } else if (statusCode === 404) {
      errorCode = 'not_found';
    } else if (statusCode === 401) {
      errorCode = 'unauthorized';
    } else if (statusCode === 403) {
      errorCode = 'forbidden';
    } else if (statusCode === 409) {
      errorCode = 'conflict';
    } else if (statusCode === 422) {
      errorCode = 'unprocessable_entity';
    }

    const response: ApiErrorResponse = {
      error: {
        code: errorCode,
        message,
        requestId,
      },
    };

    return reply.status(statusCode).send(response);
  });
};

export default fp(errorHandlerPlugin);
