import { notFound } from '../middleware/errors';
import { projectRepository } from '../repositories/projectRepository';
import { scopingItemRepository } from '../repositories/scopingItemRepository';
import type {
  CreateScopingItemInput,
  UpdateScopingItemInput,
} from '../validation/schemas';
import type { ScopingStatus, ScopingType } from '../models';

async function assertProject(projectId: string) {
  if (!(await projectRepository.findById(projectId))) throw notFound('Projet');
}

async function getInProject(projectId: string, itemId: string) {
  await assertProject(projectId);
  const item = await scopingItemRepository.findInProject(projectId, itemId);
  if (!item) throw notFound('Élément de cadrage');
  return item;
}

export const scopingService = {
  async list(projectId: string, filters: { type?: ScopingType; status?: ScopingStatus } = {}) {
    await assertProject(projectId);
    return scopingItemRepository.findByProject(projectId, filters);
  },
  async create(projectId: string, input: CreateScopingItemInput) {
    await assertProject(projectId);
    return scopingItemRepository.create(projectId, input);
  },
  async update(projectId: string, itemId: string, input: UpdateScopingItemInput) {
    const item = await getInProject(projectId, itemId);
    return scopingItemRepository.update(item, input);
  },
  async remove(projectId: string, itemId: string) {
    const item = await getInProject(projectId, itemId);
    await scopingItemRepository.destroy(item);
  },
};
