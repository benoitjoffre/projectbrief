import { Router } from 'express';
import { clientController } from '../controllers/clientController';
import { projectController } from '../controllers/projectController';

export const apiRouter = Router();

apiRouter.get('/clients', clientController.list);
apiRouter.get('/clients/:id', clientController.get);
apiRouter.post('/clients', clientController.create);
apiRouter.patch('/clients/:id', clientController.update);

apiRouter.get('/projects', projectController.list);
apiRouter.get('/projects/:id', projectController.get);
apiRouter.post('/projects', projectController.create);
apiRouter.patch('/projects/:id', projectController.update);
