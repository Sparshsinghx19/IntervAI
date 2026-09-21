import { Router } from 'express';
import { interviewController } from './interview.controller';

const interviewRouter = Router();

interviewRouter.post('/', interviewController.createInterview);

export { interviewRouter };
