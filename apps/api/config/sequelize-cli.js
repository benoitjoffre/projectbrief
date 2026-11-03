// Configuration lue par sequelize-cli (migrations uniquement).
require('dotenv').config();

const base = { dialect: 'postgres', logging: false };

module.exports = {
  development: { ...base, url: process.env.DATABASE_URL },
  production: { ...base, url: process.env.DATABASE_URL },
  test: { ...base, url: process.env.TEST_DATABASE_URL },
};
