import type { Request, Response } from 'express';
import { questionnaireShareService } from '../services/questionnaireShareService';
import { publicQuestionnaireService } from '../services/publicQuestionnaireService';
import { recordTokenFailure } from '../middleware/rateLimit';
import { AppError } from '../middleware/errors';
import {
  projectIdParamSchema,
  publicAnswerParamsSchema,
  publicAnswerSchema,
  publicTokenParamSchema,
} from '../validation/schemas';

export const questionnaireShareController = {
  async create(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    res.status(201).json(await questionnaireShareService.create(projectId));
  },
  async status(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    res.json(await questionnaireShareService.status(projectId));
  },
  async revoke(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    res.json(await questionnaireShareService.revoke(projectId));
  },
};

/** Les erreurs de jeton comptent pour la limitation anti-devinette ; les autres erreurs non. */
async function guarded<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError && err.status === 404 && err.message === 'Lien introuvable') {
      throw recordTokenFailure(req) ?? err;
    }
    throw err;
  }
}

const parseToken = (req: Request) => {
  const parsed = publicTokenParamSchema.safeParse(req.params);
  if (!parsed.success) throw new AppError(404, 'NOT_FOUND', 'Lien introuvable');
  return parsed.data.token;
};

export const publicQuestionnaireController = {
  get: (req: Request, res: Response) =>
    guarded(req, async () => res.json(await publicQuestionnaireService.get(parseToken(req)))),
  saveAnswer: (req: Request, res: Response) =>
    guarded(req, async () => {
      const token = parseToken(req);
      const { questionId } = publicAnswerParamsSchema.parse(req.params);
      const input = publicAnswerSchema.parse(req.body ?? {});
      res.json(await publicQuestionnaireService.saveAnswer(token, questionId, input));
    }),
  complete: (req: Request, res: Response) =>
    guarded(req, async () => res.json(await publicQuestionnaireService.complete(parseToken(req)))),
};
