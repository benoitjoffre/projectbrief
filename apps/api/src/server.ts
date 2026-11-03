import { createApp } from './app';
import { sequelize } from './config/database';
import { env } from './config/env';

async function main() {
  await sequelize.authenticate();
  createApp().listen(env.port, () => {
    console.log(`API ProjectBrief sur http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('Démarrage impossible :', err.message);
  process.exit(1);
});
