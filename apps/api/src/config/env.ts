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

export const env = {
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl,
  isTest,
};
