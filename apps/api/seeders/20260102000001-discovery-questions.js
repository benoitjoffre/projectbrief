'use strict';

const { categories, questions } = require('./data/discovery-questions');

// Idempotent : upsert sur des identifiants stables. is_active n'est jamais réécrit au re-seed
// (un désactivation manuelle est conservée).
/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.transaction(async (transaction) => {
      for (const c of categories) {
        await sequelize.query(
          `INSERT INTO question_categories (id, title, description, sort_order, created_at, updated_at)
           VALUES (:id, :title, NULL, :sortOrder, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE
             SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order, updated_at = NOW()`,
          { replacements: c, transaction },
        );
      }
      for (const q of questions) {
        await sequelize.query(
          `INSERT INTO questions (id, category_id, label, help_text, sort_order, is_active, created_at, updated_at)
           VALUES (:id, :categoryId, :label, NULL, :sortOrder, TRUE, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE
             SET category_id = EXCLUDED.category_id, label = EXCLUDED.label,
                 sort_order = EXCLUDED.sort_order, updated_at = NOW()`,
          { replacements: q, transaction },
        );
      }
    });
  },

  // Échoue volontairement (FK RESTRICT) si des réponses existent : aucune donnée n'est perdue.
  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('questions', { id: { [Op.in]: questions.map((q) => q.id) } });
    await queryInterface.bulkDelete('question_categories', { id: { [Op.in]: categories.map((c) => c.id) } });
  },
};
