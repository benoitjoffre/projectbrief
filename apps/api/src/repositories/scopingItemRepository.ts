import type { WhereOptions } from 'sequelize';
import { ScopingItem } from '../models';
import type { CreateScopingItemInput, UpdateScopingItemInput } from '../validation/schemas';

export const scopingItemRepository = {
  findByProject: (projectId: string, filters: WhereOptions<ScopingItem> = {}) =>
    ScopingItem.findAll({ where: { ...filters, projectId }, order: [['createdAt', 'ASC']] }),
  findInProject: (projectId: string, id: string) => ScopingItem.findOne({ where: { id, projectId } }),
  create: (projectId: string, data: CreateScopingItemInput) => ScopingItem.create({ ...data, projectId }),
  update: (item: ScopingItem, data: UpdateScopingItemInput) => item.update(data),
  destroy: (item: ScopingItem) => item.destroy(),
};
