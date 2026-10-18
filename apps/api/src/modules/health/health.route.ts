import { Router } from 'express';
import { healthController } from './health.controller.js';

const healthRouter = Router();

healthRouter.get('/', healthController.getHealth);
healthRouter.get('/ready', healthController.getReady);

export { healthRouter };
