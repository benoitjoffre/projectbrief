import { FEATURE_PRIORITIES, SCOPING_TYPES } from '../models';
import type { Feature, ScopingItem } from '../models';
import { notFound } from '../middleware/errors';
import { featureRepository } from '../repositories/featureRepository';
import { projectRepository } from '../repositories/projectRepository';
import { scopingItemRepository } from '../repositories/scopingItemRepository';
import { discoveryService } from './discoveryService';

function groupBy<T, K extends string>(keys: readonly K[], items: T[], key: (item: T) => K) {
  const groups = Object.fromEntries(keys.map((k) => [k, [] as T[]])) as Record<K, T[]>;
  for (const item of items) groups[key(item)].push(item);
  return groups;
}

/** Synthèse entièrement calculée à la lecture : rien n'est dupliqué en base. */
export const summaryService = {
  async get(projectId: string) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound('Projet');

    const [discovery, features, items] = await Promise.all([
      discoveryService.progress(projectId),
      featureRepository.findByProject(projectId),
      scopingItemRepository.findByProject(projectId),
    ]);

    const byPriority = groupBy<Feature, (typeof FEATURE_PRIORITIES)[number]>(
      FEATURE_PRIORITIES,
      features,
      (f) => f.priority,
    );
    const byType = groupBy<ScopingItem, (typeof SCOPING_TYPES)[number]>(SCOPING_TYPES, items, (i) => i.type);

    return {
      project,
      client: project.client ?? null,
      discovery,
      features: byPriority,
      // Périmètre MVP : les fonctionnalités MUST.
      mvp: byPriority.MUST,
      scopingItems: byType,
      openQuestions: byType.OPEN_QUESTION.filter((i) => i.status !== 'RESOLVED'),
      unresolvedHighRisks: byType.RISK.filter((i) => i.severity === 'HIGH' && i.status !== 'RESOLVED'),
      decisionsCount: byType.DECISION.length,
    };
  },
};
