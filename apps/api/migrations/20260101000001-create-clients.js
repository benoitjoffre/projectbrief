'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('clients', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      email: { type: Sequelize.STRING(255), allowNull: true },
      phone: { type: Sequelize.STRING(50), allowNull: true },
      company: { type: Sequelize.STRING(255), allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
    await queryInterface.addIndex('clients', ['name'], { name: 'clients_name_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('clients');
  },
};
