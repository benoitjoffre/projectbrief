import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errors';
import './models';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
