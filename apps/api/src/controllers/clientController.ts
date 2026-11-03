import type { Request, Response } from 'express';
import { clientService } from '../services/clientService';
import { createClientSchema, idParamSchema, updateClientSchema } from '../validation/schemas';

export const clientController = {
  async list(_req: Request, res: Response) {
    res.json(await clientService.list());
  },
  async get(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await clientService.get(id));
  },
  async create(req: Request, res: Response) {
    const input = createClientSchema.parse(req.body);
    res.status(201).json(await clientService.create(input));
  },
  async update(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const input = updateClientSchema.parse(req.body);
    res.json(await clientService.update(id, input));
  },
};
