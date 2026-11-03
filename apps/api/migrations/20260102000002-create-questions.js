'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('questions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'question_categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      label: { type: Sequelize.TEXT, allowNull: false },
      help_text: { type: Sequelize.TEXT, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('questions', ['category_id', 'sort_order'], {
      name: 'questions_category_sort_idx',
    });
    await queryInterface.addIndex('questions', ['is_active'], { name: 'questions_is_active_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('questions');
  },
};
