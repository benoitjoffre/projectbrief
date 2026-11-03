import type { Request, Response } from 'express';
import { discoveryService } from '../services/discoveryService';
import { answerParamsSchema, projectIdParamSchema, upsertAnswerSchema } from '../validation/schemas';

export const discoveryController = {
  async listQuestions(_req: Request, res: Response) {
    res.json(await discoveryService.listQuestions());
  },
  async listAnswers(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    res.json(await discoveryService.listAnswers(projectId));
  },
  async saveAnswer(req: Request, res: Response) {
    const { projectId, questionId } = answerParamsSchema.parse(req.params);
    const input = upsertAnswerSchema.parse(req.body);
    res.json(await discoveryService.saveAnswer(projectId, questionId, input));
  },
  async progress(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    res.json(await discoveryService.progress(projectId));
  },
};
