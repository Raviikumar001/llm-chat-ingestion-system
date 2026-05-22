import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ZodSchema, ZodError } from 'zod';

declare module 'fastify' {
  interface FastifyRequest {
    validatedBody?: unknown;
    validatedParams?: unknown;
    validatedQuery?: unknown;
  }
}

interface ValidateOptions {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

const validatePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.decorateRequest('validatedBody', undefined);
  fastify.decorateRequest('validatedParams', undefined);
  fastify.decorateRequest('validatedQuery', undefined);
};

export function validateHook(options: ValidateOptions) {
  return async (request: FastifyRequest) => {
    if (options.body) {
      const result = options.body.safeParse(request.body);
      if (!result.success) {
        const error = new Error('Validation failed') as Error & { issues: ZodError['issues'] };
        error.issues = result.error.issues;
        throw error;
      }
      request.validatedBody = result.data;
    }

    if (options.params) {
      const result = options.params.safeParse(request.params);
      if (!result.success) {
        const error = new Error('Validation failed') as Error & { issues: ZodError['issues'] };
        error.issues = result.error.issues;
        throw error;
      }
      request.validatedParams = result.data;
    }

    if (options.query) {
      const result = options.query.safeParse(request.query);
      if (!result.success) {
        const error = new Error('Validation failed') as Error & { issues: ZodError['issues'] };
        error.issues = result.error.issues;
        throw error;
      }
      request.validatedQuery = result.data;
    }
  };
}

export default fp(validatePlugin);
