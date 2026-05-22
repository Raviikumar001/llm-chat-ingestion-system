import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';

import errorHandler from './plugins/error-handler';
import requestId from './plugins/request-id';
import logger from './plugins/logger';

import healthRoutes from './routes/health';
import conversationRoutes from './routes/conversations';
import chatRoutes from './routes/chat';
import ingestionRoutes from './routes/ingestion';

dotenv.config();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    } : undefined,
  },
});

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
  await app.register(errorHandler);

  // Routes
  await app.register(healthRoutes);
  await app.register(conversationRoutes);
  await app.register(chatRoutes);
  await app.register(ingestionRoutes);

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
