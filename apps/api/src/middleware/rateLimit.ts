import type { Request, RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from './errors';

/** Fenêtre fixe en mémoire, par clé. Suffisant pour une instance unique ; à remplacer (Redis…) si on scale. */
export class RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly windowMs: number,
    /** Modifiable : les tests abaissent la limite. */
    public max: number,
  ) {}

  /** Enregistre une requête ; retourne les secondes avant réessai si la limite est dépassée, sinon 0. */
  hit(key: string, now = Date.now()): number {
    this.sweep(now);
    let b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, b);
    }
    b.count++;
    return b.count > this.max ? Math.ceil((b.resetAt - now) / 1000) : 0;
  }

  /** Secondes avant réessai si la clé est déjà bloquée, sans compter une nouvelle requête. */
  blockedFor(key: string, now = Date.now()): number {
    const b = this.buckets.get(key);
    return b && b.resetAt > now && b.count > this.max ? Math.ceil((b.resetAt - now) / 1000) : 0;
  }

  reset() {
    this.buckets.clear();
  }

  private sweep(now: number) {
    if (this.buckets.size < 5000) return;
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}

const tooMany = (retryAfter: number) =>
  new AppError(429, 'RATE_LIMITED', `Trop de requêtes, réessayez dans ${retryAfter} s`, { retryAfter });

const keyOf = (req: Request) => req.ip ?? 'unknown';

// Limites générales de l'API publique, et limite plus stricte sur les jetons invalides (anti-devinette).
export const publicLimiter = new RateLimiter(60_000, env.isTest ? 1_000_000 : 300);
export const tokenFailureLimiter = new RateLimiter(10 * 60_000, env.isTest ? 1_000_000 : 20);

export const publicRateLimit: RequestHandler = (req, res, next) => {
  const retry = publicLimiter.hit(keyOf(req)) || tokenFailureLimiter.blockedFor(keyOf(req));
  if (retry) {
    res.set('Retry-After', String(retry));
    return next(tooMany(retry));
  }
  next();
};

/** À appeler quand un jeton est invalide, inconnu ou désactivé. */
export const recordTokenFailure = (req: Request) => {
  const retry = tokenFailureLimiter.hit(keyOf(req));
  return retry ? tooMany(retry) : null;
};
