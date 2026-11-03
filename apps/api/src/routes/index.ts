import { Router } from 'express';
import { publicQuestionnaireController, questionnaireShareController } from '../controllers/questionnaireShareController';
import { publicRateLimit } from '../middleware/rateLimit';
import { clientController } from '../controllers/clientController';
import { documentController } from '../controllers/documentController';
import { featureController } from '../controllers/featureController';
import { scopingController } from '../controllers/scopingController';
import { projectController } from '../controllers/projectController';
import { discoveryController } from '../controllers/discoveryController';

export const apiRouter = Router();

apiRouter.get('/clients', clientController.list);
apiRouter.get('/clients/:id', clientController.get);
apiRouter.post('/clients', clientController.create);
apiRouter.patch('/clients/:id', clientController.update);

apiRouter.get('/projects', projectController.list);
apiRouter.get('/projects/:id', projectController.get);
apiRouter.post('/projects', projectController.create);
apiRouter.patch('/projects/:id', projectController.update);

apiRouter.get('/questions', discoveryController.listQuestions);
apiRouter.get('/projects/:projectId/answers', discoveryController.listAnswers);
apiRouter.put('/projects/:projectId/answers/:questionId', discoveryController.saveAnswer);
apiRouter.get('/projects/:projectId/discovery/progress', discoveryController.progress);

apiRouter.get('/projects/:projectId/features', featureController.list);
apiRouter.post('/projects/:projectId/features', featureController.create);
apiRouter.patch('/projects/:projectId/features/:featureId', featureController.update);
apiRouter.delete('/projects/:projectId/features/:featureId', featureController.remove);

apiRouter.get('/projects/:projectId/scoping-items', scopingController.list);
apiRouter.post('/projects/:projectId/scoping-items', scopingController.create);
apiRouter.patch('/projects/:projectId/scoping-items/:itemId', scopingController.update);
apiRouter.delete('/projects/:projectId/scoping-items/:itemId', scopingController.remove);

apiRouter.get('/projects/:projectId/summary', scopingController.summary);

apiRouter.get('/projects/:projectId/document/warnings', documentController.warnings);
apiRouter.post('/projects/:projectId/document/preview', documentController.preview);
apiRouter.post('/projects/:projectId/document/download', documentController.download);

// Liens clients (administration)
apiRouter.get('/projects/:projectId/questionnaire-share', questionnaireShareController.status);
apiRouter.post('/projects/:projectId/questionnaire-share', questionnaireShareController.create);
apiRouter.delete('/projects/:projectId/questionnaire-share', questionnaireShareController.revoke);

/**
 * API publique : n'expose que le questionnaire du projet lié au jeton.
 * Routeur séparé, monté sans l'authentification admin mais avec limitation de débit ; il ne contient
 * aucune route d'administration, donc un jeton ne donne jamais accès à autre chose.
 */
export const publicRouter = Router();
publicRouter.use(publicRateLimit);
publicRouter.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  next();
});
publicRouter.get('/questionnaires/:token', publicQuestionnaireController.get);
publicRouter.put('/questionnaires/:token/answers/:questionId', publicQuestionnaireController.saveAnswer);
publicRouter.post('/questionnaires/:token/complete', publicQuestionnaireController.complete);
