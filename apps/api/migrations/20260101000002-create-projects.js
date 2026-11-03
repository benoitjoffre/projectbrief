'use strict';

const TYPES = ['WEBSITE', 'WEB_APP', 'SAAS', 'API', 'OTHER'];
const STATUSES = ['DRAFT', 'DISCOVERY', 'SCOPING', 'READY', 'ARCHIVED'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('projects', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      client_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'clients', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      objective: { type: Sequelize.TEXT, allowNull: true },
      type: { type: Sequelize.ENUM(...TYPES), allowNull: false, defaultValue: 'OTHER' },
      status: { type: Sequelize.ENUM(...STATUSES), allowNull: false, defaultValue: 'DRAFT' },
      deadline: { type: Sequelize.DATEONLY, allowNull: true },
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
    await queryInterface.addIndex('projects', ['client_id'], { name: 'projects_client_id_idx' });
    await queryInterface.addIndex('projects', ['status'], { name: 'projects_status_idx' });
    await queryInterface.addIndex('projects', ['created_at'], { name: 'projects_created_at_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('projects');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_projects_type"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_projects_status"');
  },
};
