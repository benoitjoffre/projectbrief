import { Project, QuestionnaireShare } from '../models';

export const questionnaireShareRepository = {
  create: (projectId: string, tokenHash: string) => QuestionnaireShare.create({ projectId, tokenHash, completedAt: null }),
  latestForProject: (projectId: string) =>
    QuestionnaireShare.findOne({ where: { projectId }, order: [['createdAt', 'DESC']] }),
  /** Seuls les liens actifs sont résolus ; un lien désactivé est indiscernable d'un lien inconnu. */
  findActiveByHash: (tokenHash: string) =>
    QuestionnaireShare.findOne({
      where: { tokenHash, isActive: true },
      include: [{ model: Project, as: 'project', attributes: ['id', 'name'], required: true }],
    }),
  async deactivateActive(projectId: string) {
    const [count] = await QuestionnaireShare.update({ isActive: false }, { where: { projectId, isActive: true } });
    return count;
  },
  /** Ne renseigne completedAt qu'une fois : un second appel conserve la date initiale. */
  async markCompleted(share: QuestionnaireShare) {
    if (!share.completedAt) await share.update({ completedAt: new Date() });
    return share;
  },
};
