import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

import { configureIngestionClient, createProvider } from '@ollive/llm-gateway';
import type { LlmProvider } from '@ollive/llm-gateway';
import type { SupportedProvider } from '@ollive/shared';
import { getSafeDefaultModel } from './config/chat-options';
import { loadApiEnv } from './config/load-env';

import errorHandler from './plugins/error-handler';
import requestId from './plugins/request-id';
import logger from './plugins/logger';
import validate from './plugins/validate';

import healthRoutes from './routes/health';
import conversationRoutes from './routes/conversations';
import chatRoutes from './routes/chat';
import ingestionRoutes from './routes/ingestion';
import metricsRoutes from './routes/metrics';

loadApiEnv();

function parseProvider(provider: string | undefined): SupportedProvider {
  if (provider === 'gemini') {
    return 'gemini';
  }

  return 'cerebras';
}

const defaultProvider = parseProvider(process.env.DEFAULT_PROVIDER);
const defaultModel = getSafeDefaultModel(defaultProvider, process.env.DEFAULT_MODEL);

function getApiKey(provider: SupportedProvider): string {
  switch (provider) {
    case 'cerebras':
      if (!process.env.CEREBRAS_API_KEY) {
        throw new Error('CEREBRAS_API_KEY environment variable is not set');
      }
      return process.env.CEREBRAS_API_KEY;
    case 'gemini':
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
      }
      return process.env.GEMINI_API_KEY;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

const ingestionEndpoint = new URL(
  '/api/v1/ingestion/inference-logs',
  `http://127.0.0.1:${process.env.API_PORT || '3001'}`
).toString();

configureIngestionClient({
  endpoint: ingestionEndpoint,
  timeoutMs: 2_500,
  maxRetries: 1,
});

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
  disableRequestLogging: true,
});

app.decorate('createLlmProvider', (provider: SupportedProvider): LlmProvider =>
  createProvider(provider, getApiKey(provider))
);
app.decorate('defaultProvider', defaultProvider);
app.decorate('defaultModel', defaultModel);

declare module 'fastify' {
  interface FastifyInstance {
    createLlmProvider: (provider: SupportedProvider) => LlmProvider;
    defaultProvider: SupportedProvider;
    defaultModel: string;
  }
}

async function start() {
  // Security plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Core plugins
  await app.register(requestId);
  await app.register(logger);
  await app.register(validate);
  await app.register(errorHandler);

  // Routes
  await app.register(healthRoutes);
  await app.register(conversationRoutes, { prefix: '/api/v1/conversations' });
  await app.register(chatRoutes, { prefix: '/api/v1/chat' });
  await app.register(ingestionRoutes, { prefix: '/api/v1/ingestion' });
  await app.register(metricsRoutes, { prefix: '/api/v1/metrics' });

  const port = parseInt(process.env.API_PORT || '3001', 10);

  try {
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`API server listening on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
