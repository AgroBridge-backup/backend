import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './presentation/middlewares/errorHandler.middleware';
import { AppError } from './shared/errors/AppError';

export function createApp(v1Router: Router): express.Application {
  const app: express.Application = express();

  // Middlewares
  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  // Routes
  app.use('/api/v1', v1Router);

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // 404 Handler
  app.use((_req, _res, next) => {
    next(new AppError('Not Found', 404));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
