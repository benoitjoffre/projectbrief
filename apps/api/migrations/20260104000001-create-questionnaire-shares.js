'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('questionnaire_shares', {
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
      // SHA-256 (hex) du jeton : le jeton lui-même n'est jamais stocké.
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('questionnaire_shares', ['project_id', 'created_at'], {
      name: 'questionnaire_shares_project_created_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('questionnaire_shares');
  },
};
