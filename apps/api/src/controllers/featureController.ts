import type { Request, Response } from 'express';
import { featureService } from '../services/featureService';
import {
  createFeatureSchema,
  featureParamsSchema,
  projectIdParamSchema,
  updateFeatureSchema,
} from '../validation/schemas';

export const featureController = {
  async list(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    res.json(await featureService.list(projectId));
  },
  async create(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const input = createFeatureSchema.parse(req.body);
    res.status(201).json(await featureService.create(projectId, input));
  },
  async update(req: Request, res: Response) {
    const { projectId, featureId } = featureParamsSchema.parse(req.params);
    const input = updateFeatureSchema.parse(req.body);
    res.json(await featureService.update(projectId, featureId, input));
  },
  async remove(req: Request, res: Response) {
    const { projectId, featureId } = featureParamsSchema.parse(req.params);
    await featureService.remove(projectId, featureId);
    res.status(204).end();
  },
};
