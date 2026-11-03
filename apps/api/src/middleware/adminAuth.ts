import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env';

const sameSecret = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

/**
 * Protège les routes d'administration. Sans ADMIN_API_TOKEN (dev local) l'accès reste ouvert ;
 * en production le jeton est obligatoire (voir config/env.ts).
 * Ce n'est qu'un garde-fou minimal : une vraie authentification reste à prévoir avant un déploiement public.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const expected = env.adminToken;
  if (!expected) return next();
  const header = req.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided && sameSecret(provided, expected)) return next();
  res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: { code: 'UNAUTHORIZED', message: 'Authentification requise' } });
};
