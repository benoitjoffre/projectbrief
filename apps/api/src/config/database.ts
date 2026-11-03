import { Sequelize } from 'sequelize';
import { env } from './env';

// Le schéma est géré uniquement par les migrations : jamais de sequelize.sync().
export const sequelize = new Sequelize(env.databaseUrl, {
  dialect: 'postgres',
  logging: false,
});
