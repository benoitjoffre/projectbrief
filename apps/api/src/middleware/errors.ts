import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} from 'sequelize';
import { env } from '../config/env';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} introuvable`);

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route introuvable' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof UniqueConstraintError) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Cette ressource existe déjà' } });
    return;
  }
  if (err instanceof ForeignKeyConstraintError) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Contrainte de référence non respectée' } });
    return;
  }
  // Corps JSON malformé
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Corps JSON invalide' } });
    return;
  }
  // Jamais de détail SQL / stack côté client.
  if (!env.isTest) console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' } });
};
