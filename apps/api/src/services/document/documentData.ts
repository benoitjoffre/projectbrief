import { notFound } from '../../middleware/errors';
import { answerRepository } from '../../repositories/answerRepository';
import { featureRepository } from '../../repositories/featureRepository';
import { projectRepository } from '../../repositories/projectRepository';
import { questionRepository } from '../../repositories/questionRepository';
import { scopingItemRepository } from '../../repositories/scopingItemRepository';
import { discoveryService } from '../discoveryService';
import type { FeaturePriority, ScopingSeverity, ScopingStatus, ScopingType } from '../../models';

/**
 * Données brutes du cahier des charges : objets simples, sans instance Sequelize.
 * C'est la seule frontière entre la base de données et la construction du document.
 */
export interface DocumentData {
  generatedAt: Date;
  project: {
    name: string;
    type: string;
    description: string | null;
    objective: string | null;
  };
  client: { name: string; company: string | null };
  discovery: {
    totalQuestions: number;
    reviewedQuestions: number;
    percentage: number;
    categories: DiscoveryCategoryData[];
  };
  features: FeatureData[];
  scopingItems: ScopingItemData[];
}

export interface DiscoveryCategoryData {
  title: string;
  entries: DiscoveryEntryData[];
}

export interface DiscoveryEntryData {
  /** Libellé historique (questionText) si une réponse existe, sinon libellé courant de la question. */
  label: string;
  /** Réponse saisie, null si aucune. */
  answer: string | null;
  isReviewed: boolean;
}

export interface FeatureData {
  title: string;
  description: string | null;
  priority: FeaturePriority;
  acceptanceCriteria: string | null;
}

export interface ScopingItemData {
  type: ScopingType;
  title: string;
  description: string | null;
  status: ScopingStatus;
  severity: ScopingSeverity | null;
  resolution: string | null;
}

export const documentDataService = {
  async collect(projectId: string, generatedAt: Date = new Date()): Promise<DocumentData> {
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound('Projet');

    const [progress, answers, questions, features, items] = await Promise.all([
      discoveryService.progress(projectId),
      answerRepository.findByProject(projectId),
      questionRepository.findAllWithCategory(),
      featureRepository.findByProject(projectId),
      scopingItemRepository.findByProject(projectId),
    ]);

    const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));
    const byCategory = new Map<string, { title: string; sortOrder: number; entries: Array<DiscoveryEntryData & { sortOrder: number }> }>();
    for (const q of questions) {
      const answer = answerByQuestion.get(q.id);
      // Une question désactivée n'apparaît que si elle a déjà reçu une réponse.
      if (!q.isActive && !answer) continue;
      const category = q.category!;
      let group = byCategory.get(category.id);
      if (!group) {
        group = { title: category.title, sortOrder: category.sortOrder, entries: [] };
        byCategory.set(category.id, group);
      }
      const value = answer?.value.trim() ?? '';
      group.entries.push({
        label: answer?.questionText ?? q.label,
        answer: value === '' ? null : value,
        isReviewed: answer?.isReviewed ?? false,
        sortOrder: q.sortOrder,
      });
    }
    const categories = [...byCategory.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
      .map((g) => ({
        title: g.title,
        entries: g.entries
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(({ sortOrder: _sortOrder, ...entry }) => entry),
      }));

    return {
      generatedAt,
      project: {
        name: project.name,
        type: project.type,
        description: project.description,
        objective: project.objective,
      },
      client: { name: project.client?.name ?? '', company: project.client?.company ?? null },
      discovery: { ...progress, categories },
      features: features.map((f) => ({
        title: f.title,
        description: f.description,
        priority: f.priority,
        acceptanceCriteria: f.acceptanceCriteria,
      })),
      scopingItems: items.map((i) => ({
        type: i.type,
        title: i.title,
        description: i.description,
        status: i.status,
        severity: i.severity,
        resolution: i.resolution,
      })),
    };
  },
};
