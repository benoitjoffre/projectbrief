'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('answers', {
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
      question_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'questions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      // Copie du libellé au moment de la première réponse : jamais modifiée ensuite.
      question_text: { type: Sequelize.TEXT, allowNull: false },
      value: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      is_reviewed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    // L'unicité (project_id, question_id) sert aussi d'index pour les lectures par projet.
    await queryInterface.addIndex('answers', ['project_id', 'question_id'], {
      name: 'answers_project_question_uq',
      unique: true,
    });
    await queryInterface.addIndex('answers', ['question_id'], { name: 'answers_question_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('answers');
  },
};
