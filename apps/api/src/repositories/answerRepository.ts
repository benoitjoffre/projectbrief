import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { Answer } from '../models';
import type { UpsertAnswerInput } from '../validation/schemas';

export type GuardedSave = { ok: true; answer: Answer } | { ok: false; current: Answer | null };

const ANSWER_COLUMNS = `id, project_id, question_id, question_text, value, is_reviewed, created_at, updated_at`;

export const answerRepository = {
  findOne: (projectId: string, questionId: string) => Answer.findOne({ where: { projectId, questionId } }),

  /**
   * Écriture conditionnelle contre les écritures obsolètes (optimistic locking sur updated_at, à la milliseconde) :
   * - expectedUpdatedAt === null : l'appelant n'a vu aucune réponse ; échoue si elle existe désormais ;
   * - sinon : n'écrit que si la réponse n'a pas changé depuis la version vue par l'appelant.
   * En cas d'échec, retourne la réponse courante pour que l'appelant puisse arbitrer.
   */
  async saveGuarded(
    projectId: string,
    question: { id: string; label: string },
    input: UpsertAnswerInput,
    expectedUpdatedAt: string | null,
  ): Promise<GuardedSave> {
    const replacements = {
      projectId,
      questionId: question.id,
      questionText: question.label,
      value: input.value ?? null,
      isReviewed: input.isReviewed ?? null,
      expected: expectedUpdatedAt,
    };
    const run = (sql: string) =>
      sequelize.query<Answer>(sql, { replacements, type: QueryTypes.SELECT, model: Answer, mapToModel: true });

    const rows =
      expectedUpdatedAt === null
        ? await run(
            `INSERT INTO answers (id, project_id, question_id, question_text, value, is_reviewed, created_at, updated_at)
             VALUES (gen_random_uuid(), :projectId, :questionId, :questionText,
                     COALESCE(:value, ''), COALESCE(:isReviewed, FALSE), NOW(), NOW())
             ON CONFLICT (project_id, question_id) DO NOTHING
             RETURNING ${ANSWER_COLUMNS}`,
          )
        : await run(
            `UPDATE answers
             SET value = COALESCE(:value, value),
                 is_reviewed = COALESCE(:isReviewed, is_reviewed),
                 updated_at = NOW()
             WHERE project_id = :projectId AND question_id = :questionId
               AND date_trunc('milliseconds', updated_at) = :expected::timestamptz
             RETURNING ${ANSWER_COLUMNS}`,
          );
    if (rows[0]) return { ok: true, answer: rows[0] };
    return { ok: false, current: await Answer.findOne({ where: { projectId, questionId: question.id } }) };
  },

  /** Réponses non vides sur des questions actives (progression côté client, sans notion de validation). */
  async countAnswered(projectId: string): Promise<number> {
    const [row] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM answers a JOIN questions q ON q.id = a.question_id
       WHERE a.project_id = :projectId AND q.is_active AND a.value ~ '\\S'`,
      { replacements: { projectId }, type: QueryTypes.SELECT },
    );
    return Number(row.count);
  },

  findByProject: (projectId: string) =>
    Answer.findAll({ where: { projectId }, order: [['createdAt', 'ASC']] }),

  /**
   * Upsert atomique adossé à la contrainte unique (project_id, question_id) : deux requêtes
   * concurrentes ne peuvent pas créer de doublon. question_text n'est écrit qu'à l'insertion.
   * Un champ absent (null) conserve la valeur existante.
   */
  async upsert(projectId: string, question: { id: string; label: string }, input: UpsertAnswerInput) {
    const rows = await sequelize.query<Answer>(
      `INSERT INTO answers (id, project_id, question_id, question_text, value, is_reviewed, created_at, updated_at)
       VALUES (gen_random_uuid(), :projectId, :questionId, :questionText,
               COALESCE(:value, ''), COALESCE(:isReviewed, FALSE), NOW(), NOW())
       ON CONFLICT (project_id, question_id) DO UPDATE
         SET value = COALESCE(:value, answers.value),
             is_reviewed = COALESCE(:isReviewed, answers.is_reviewed),
             updated_at = NOW()
       RETURNING *`,
      {
        replacements: {
          projectId,
          questionId: question.id,
          questionText: question.label,
          value: input.value ?? null,
          isReviewed: input.isReviewed ?? null,
        },
        type: QueryTypes.SELECT,
        model: Answer,
        mapToModel: true,
      },
    );
    return rows[0];
  },

  /** Questions actives dont la réponse est validée et non vide. */
  async countCompletedForProject(projectId: string): Promise<number> {
    const [row] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM answers a JOIN questions q ON q.id = a.question_id
       WHERE a.project_id = :projectId AND q.is_active AND a.is_reviewed AND a.value ~ '\\S'`,
      { replacements: { projectId }, type: QueryTypes.SELECT },
    );
    return Number(row.count);
  },
};
