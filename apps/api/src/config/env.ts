import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const isTest = process.env.NODE_ENV === 'test';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

const databaseUrl = isTest ? required('TEST_DATABASE_URL') : required('DATABASE_URL');

// Garde-fou : les tests vident les tables, ils ne doivent jamais viser la base de dev.
if (isTest && databaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL doit être différente de DATABASE_URL.');
}

const isProduction = process.env.NODE_ENV === 'production';
const adminToken = process.env.ADMIN_API_TOKEN || null;
// Les routes d'administration ne doivent jamais être ouvertes sur une instance publique.
if (isProduction && !adminToken) {
  throw new Error('ADMIN_API_TOKEN est obligatoire en production (protection des routes d’administration).');
}

export const env = {
  /** Jeton Bearer exigé sur les routes d'administration ; null = désactivé (développement local). */
  adminToken: adminToken as string | null,
  /** Valeur de `trust proxy` d'Express (ex. « 1 » derrière un reverse proxy) pour que req.ip soit fiable. */
  trustProxy: process.env.TRUST_PROXY ?? null,
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl,
  isTest,
};
