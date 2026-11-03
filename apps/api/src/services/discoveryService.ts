import { AppError, notFound } from '../middleware/errors';
import { answerRepository } from '../repositories/answerRepository';
import { projectRepository } from '../repositories/projectRepository';
import { questionRepository } from '../repositories/questionRepository';
import type { UpsertAnswerInput } from '../validation/schemas';

/** 409 portant la réponse courante : le client peut proposer de garder sa version ou de reprendre celle du serveur. */
export function staleWrite(current: { value: string; isReviewed: boolean; updatedAt: Date } | null) {
  return new AppError(409, 'STALE_WRITE', 'Cette réponse a été modifiée entre-temps.', {
    current: current && {
      value: current.value,
      isReviewed: current.isReviewed,
      updatedAt: current.updatedAt.toISOString(),
    },
  });
}

async function assertProject(projectId: string) {
  if (!(await projectRepository.findById(projectId))) throw notFound('Projet');
}

export const discoveryService = {
  listQuestions: () => questionRepository.findCategoriesWithActiveQuestions(),

  async listAnswers(projectId: string) {
    await assertProject(projectId);
    return answerRepository.findByProject(projectId);
  },

  async saveAnswer(projectId: string, questionId: string, input: UpsertAnswerInput) {
    await assertProject(projectId);
    const question = await questionRepository.findById(questionId);
    if (!question) throw notFound('Question');
    const { expectedUpdatedAt, ...fields } = input;
    // Sans expectedUpdatedAt : comportement historique (dernière écriture gagnante).
    if (expectedUpdatedAt === undefined) return answerRepository.upsert(projectId, question, fields);
    const result = await answerRepository.saveGuarded(projectId, question, fields, expectedUpdatedAt);
    if (!result.ok) throw staleWrite(result.current);
    return result.answer;
  },

  // Calculée à la volée, jamais stockée.
  async progress(projectId: string) {
    await assertProject(projectId);
    const [totalQuestions, reviewedQuestions] = await Promise.all([
      questionRepository.countActive(),
      answerRepository.countCompletedForProject(projectId),
    ]);
    const percentage = totalQuestions === 0 ? 0 : Math.round((reviewedQuestions / totalQuestions) * 100);
    return { totalQuestions, reviewedQuestions, percentage };
  },
};
