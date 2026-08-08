import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from '@config/env';
import routes from '@routes/index';
import { errorHandler, notFoundHandler } from '@middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
      // Browsers hide all response headers from JS by default except a small
      // "simple" allowlist — RateLimit-Reset needs to be explicitly exposed or
      // the frontend can't read it to show an accurate retry countdown on 429.
      exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(env.cookieSecret));

  if (!env.isProduction && !env.isTest) {
    app.use(morgan('dev'));
  }

  if (!env.isTest) {
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api', apiLimiter);
  }

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
