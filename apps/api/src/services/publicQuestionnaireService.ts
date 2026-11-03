import { AppError, notFound } from '../middleware/errors';
import { answerRepository } from '../repositories/answerRepository';
import { questionRepository } from '../repositories/questionRepository';
import { questionnaireShareRepository } from '../repositories/questionnaireShareRepository';
import { discoveryService, staleWrite } from './discoveryService';
import { hashToken } from './questionnaireShareService';

/** Même message pour un jeton inconnu, mal formé ou désactivé : on ne révèle rien. */
export const invalidLink = () => notFound('Lien');

async function resolveShare(token: string) {
  const share = await questionnaireShareRepository.findActiveByHash(hashToken(token));
  if (!share?.project) throw invalidLink();
  return share;
}

async function progress(projectId: string) {
  const [totalQuestions, answeredQuestions] = await Promise.all([
    questionRepository.countActive(),
    answerRepository.countAnswered(projectId),
  ]);
  const percentage = totalQuestions === 0 ? 0 : Math.round((answeredQuestions / totalQuestions) * 100);
  return { totalQuestions, answeredQuestions, percentage };
}

/**
 * Accès client sans connexion. Tout est limité au projet porté par le lien :
 * seuls le nom du projet, les questions actives et les réponses de ce projet sont exposés.
 */
export const publicQuestionnaireService = {
  async get(token: string) {
    const share = await resolveShare(token);
    const projectId = share.projectId;
    const [categories, answers, prog] = await Promise.all([
      discoveryService.listQuestions(),
      answerRepository.findByProject(projectId),
      progress(projectId),
    ]);
    return {
      project: { name: share.project!.name },
      completedAt: share.completedAt?.toISOString() ?? null,
      categories: categories.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        questions: (c.questions ?? []).map((q) => ({ id: q.id, label: q.label, helpText: q.helpText })),
      })),
      answers: answers.map((a) => ({ questionId: a.questionId, value: a.value, updatedAt: a.updatedAt.toISOString() })),
      progress: prog,
    };
  },

  async saveAnswer(token: string, questionId: string, input: { value: string; expectedUpdatedAt?: string | null }) {
    const share = await resolveShare(token);
    if (share.completedAt) {
      throw new AppError(409, 'ALREADY_COMPLETED', 'Le questionnaire est terminé : les réponses ne peuvent plus être modifiées.');
    }
    const question = await questionRepository.findById(questionId);
    if (!question?.isActive) throw notFound('Question');

    const { expectedUpdatedAt, value } = input;
    // isReviewed n'est jamais transmis : le client ne peut pas « valider » une réponse.
    const result =
      expectedUpdatedAt === undefined
        ? { ok: true as const, answer: await answerRepository.upsert(share.projectId, question, { value }) }
        : await answerRepository.saveGuarded(share.projectId, question, { value }, expectedUpdatedAt);
    if (!result.ok) throw staleWrite(result.current);
    return {
      questionId,
      value: result.answer.value,
      updatedAt: result.answer.updatedAt.toISOString(),
      progress: await progress(share.projectId),
    };
  },

  /** Idempotent : un second appel renvoie la date de la première validation. */
  async complete(token: string) {
    const share = await resolveShare(token);
    await questionnaireShareRepository.markCompleted(share);
    return { completedAt: share.completedAt!.toISOString() };
  },
};
