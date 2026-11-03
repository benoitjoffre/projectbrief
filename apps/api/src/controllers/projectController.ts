import type { Request, Response } from 'express';
import { projectService } from '../services/projectService';
import {
  createProjectSchema,
  idParamSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from '../validation/schemas';

export const projectController = {
  async list(req: Request, res: Response) {
    const filters = listProjectsQuerySchema.parse(req.query);
    res.json(await projectService.list(filters));
  },
  async get(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await projectService.get(id));
  },
  async create(req: Request, res: Response) {
    const input = createProjectSchema.parse(req.body);
    res.status(201).json(await projectService.create(input));
  },
  async update(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const input = updateProjectSchema.parse(req.body);
    res.json(await projectService.update(id, input));
  },
};
