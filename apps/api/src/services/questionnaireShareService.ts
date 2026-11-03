import { createHash, randomBytes } from 'node:crypto';
import { notFound } from '../middleware/errors';
import { projectRepository } from '../repositories/projectRepository';
import { questionnaireShareRepository } from '../repositories/questionnaireShareRepository';
import type { QuestionnaireShare } from '../models';
import { sequelize } from '../config/database';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const toStatus = (share: QuestionnaireShare | null) => ({
  active: share?.isActive ?? false,
  share: share && {
    id: share.id,
    isActive: share.isActive,
    completedAt: share.completedAt?.toISOString() ?? null,
    createdAt: share.createdAt.toISOString(),
  },
});

/** Administration des liens clients (jamais atteignable avec un jeton public). */
export const questionnaireShareService = {
  async create(projectId: string) {
    if (!(await projectRepository.findById(projectId))) throw notFound('Projet');
    const token = randomBytes(32).toString('base64url'); // 256 bits, 43 caractères
    // Un seul lien actif par projet : générer un nouveau lien désactive l'ancien. Les réponses ne sont pas touchées.
    const share = await sequelize.transaction(async () => {
      await questionnaireShareRepository.deactivateActive(projectId);
      return questionnaireShareRepository.create(projectId, hashToken(token));
    });
    // Le jeton n'est retourné qu'ici : seul son hash est conservé.
    return { ...toStatus(share), token, path: `/q/${token}` };
  },

  async status(projectId: string) {
    if (!(await projectRepository.findById(projectId))) throw notFound('Projet');
    return toStatus(await questionnaireShareRepository.latestForProject(projectId));
  },

  async revoke(projectId: string) {
    if (!(await projectRepository.findById(projectId))) throw notFound('Projet');
    await questionnaireShareRepository.deactivateActive(projectId);
    return toStatus(await questionnaireShareRepository.latestForProject(projectId));
  },
};
