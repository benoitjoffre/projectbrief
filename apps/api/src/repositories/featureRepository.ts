import { Feature } from '../models';
import type { CreateFeatureInput, UpdateFeatureInput } from '../validation/schemas';

export const featureRepository = {
  findByProject: (projectId: string) =>
    Feature.findAll({
      where: { projectId },
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    }),
  // Filtrer sur projectId garantit l'appartenance de la fonctionnalité au projet.
  findInProject: (projectId: string, id: string) => Feature.findOne({ where: { id, projectId } }),
  create: (projectId: string, data: CreateFeatureInput) => Feature.create({ ...data, projectId }),
  update: (feature: Feature, data: UpdateFeatureInput) => feature.update(data),
  destroy: (feature: Feature) => feature.destroy(),
};
