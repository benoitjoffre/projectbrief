import { notFound } from '../middleware/errors';
import { featureRepository } from '../repositories/featureRepository';
import { projectRepository } from '../repositories/projectRepository';
import type { CreateFeatureInput, UpdateFeatureInput } from '../validation/schemas';

async function assertProject(projectId: string) {
  if (!(await projectRepository.findById(projectId))) throw notFound('Projet');
}

async function getInProject(projectId: string, featureId: string) {
  await assertProject(projectId);
  const feature = await featureRepository.findInProject(projectId, featureId);
  if (!feature) throw notFound('Fonctionnalité');
  return feature;
}

export const featureService = {
  async list(projectId: string) {
    await assertProject(projectId);
    return featureRepository.findByProject(projectId);
  },
  async create(projectId: string, input: CreateFeatureInput) {
    await assertProject(projectId);
    return featureRepository.create(projectId, input);
  },
  async update(projectId: string, featureId: string, input: UpdateFeatureInput) {
    const feature = await getInProject(projectId, featureId);
    return featureRepository.update(feature, input);
  },
  async remove(projectId: string, featureId: string) {
    const feature = await getInProject(projectId, featureId);
    await featureRepository.destroy(feature);
  },
};
