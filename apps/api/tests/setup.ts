import { createRequire } from 'node:module';
import request from 'supertest';
import { sequelize } from '../src/config/database';
import { createApp } from '../src/app';
import { Client, Project } from '../src/models';

export const app = createApp();
export const api = () => request(app);

// Tables vidées uniquement sur la base de test (garde-fou dans config/env.ts).
export async function resetDb() {
  await Project.destroy({ where: {} });
  await Client.destroy({ where: {} });
}

export async function closeDb() {
  await sequelize.close();
}

// Le seeder (CommonJS, idempotent) est celui utilisé en développement.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const seeder = createRequire(__filename)('../seeders/20260102000001-discovery-questions.js');
export const seedQuestions = () => seeder.up(sequelize.getQueryInterface());
