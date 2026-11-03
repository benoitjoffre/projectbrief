'use strict';

const TYPES = ['CONSTRAINT', 'RISK', 'DEPENDENCY', 'ASSUMPTION', 'DECISION', 'OPEN_QUESTION'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('scoping_items', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.ENUM(...TYPES), allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.ENUM(...STATUSES), allowNull: false, defaultValue: 'OPEN' },
      severity: { type: Sequelize.ENUM(...SEVERITIES), allowNull: true },
      resolution: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('scoping_items', ['project_id', 'type', 'status'], {
      name: 'scoping_items_project_type_status_idx',
    });
    await queryInterface.addIndex('scoping_items', ['project_id', 'created_at'], {
      name: 'scoping_items_project_created_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('scoping_items');
    for (const name of ['type', 'status', 'severity']) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_scoping_items_${name}"`);
    }
  },
};
