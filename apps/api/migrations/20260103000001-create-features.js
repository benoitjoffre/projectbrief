'use strict';

const PRIORITIES = ['MUST', 'SHOULD', 'COULD', 'WONT'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('features', {
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
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      priority: { type: Sequelize.ENUM(...PRIORITIES), allowNull: false, defaultValue: 'COULD' },
      acceptance_criteria: { type: Sequelize.TEXT, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('features', ['project_id', 'sort_order', 'created_at'], {
      name: 'features_project_order_idx',
    });
    await queryInterface.addIndex('features', ['project_id', 'priority'], {
      name: 'features_project_priority_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('features');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_features_priority"');
  },
};
