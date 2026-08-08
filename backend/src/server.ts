import http from 'http';
import { createApp } from './app';
import { connectDB } from '@config/db';
import { initializeSocket } from '@sockets/index';
import { env } from '@config/env';
import { logger } from '@utils/logger';

async function bootstrap(): Promise<void> {
  await connectDB();

  const app = createApp();
  const httpServer = http.createServer(app);

  initializeSocket(httpServer);

  httpServer.listen(env.port, () => {
    logger.info(`MediShift API running in ${env.nodeEnv} mode on port ${env.port}`);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
