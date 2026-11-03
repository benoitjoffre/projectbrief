import { notFound } from '../middleware/errors';
import { answerRepository } from '../repositories/answerRepository';
import { projectRepository } from '../repositories/projectRepository';
import { questionRepository } from '../repositories/questionRepository';
import type { UpsertAnswerInput } from '../validation/schemas';

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
    return answerRepository.upsert(projectId, question, input);
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
