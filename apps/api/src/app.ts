import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errors';
import './models';
import { requireAdmin } from './middleware/adminAuth';
import { apiRouter, publicRouter } from './routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', /^\d+$/.test(env.trustProxy) ? Number(env.trustProxy) : env.trustProxy);
  app.use(cors({ origin: env.corsOrigin, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/public', publicRouter);
  app.use('/api', requireAdmin, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
