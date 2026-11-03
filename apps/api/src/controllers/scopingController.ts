import type { Request, Response } from 'express';
import { scopingService } from '../services/scopingService';
import { summaryService } from '../services/summaryService';
import {
  createScopingItemSchema,
  listScopingItemsQuerySchema,
  projectIdParamSchema,
  scopingItemParamsSchema,
  updateScopingItemSchema,
} from '../validation/schemas';

export const scopingController = {
  async list(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const filters = listScopingItemsQuerySchema.parse(req.query);
    res.json(await scopingService.list(projectId, filters));
  },
  async create(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const input = createScopingItemSchema.parse(req.body);
    res.status(201).json(await scopingService.create(projectId, input));
  },
  async update(req: Request, res: Response) {
    const { projectId, itemId } = scopingItemParamsSchema.parse(req.params);
    const input = updateScopingItemSchema.parse(req.body);
    res.json(await scopingService.update(projectId, itemId, input));
  },
  async remove(req: Request, res: Response) {
    const { projectId, itemId } = scopingItemParamsSchema.parse(req.params);
    await scopingService.remove(projectId, itemId);
    res.status(204).end();
  },
  async summary(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    res.json(await summaryService.get(projectId));
  },
};
