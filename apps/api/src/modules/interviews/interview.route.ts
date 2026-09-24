import { Router } from 'express';
import { interviewController } from './interview.controller.js';

const interviewRouter = Router();

interviewRouter.post('/', interviewController.createInterview);

export { interviewRouter };
