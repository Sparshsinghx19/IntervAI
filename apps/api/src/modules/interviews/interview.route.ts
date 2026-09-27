import { Router } from 'express';
import { interviewController } from './interview.controller.js';

const interviewRouter = Router();

interviewRouter.post('/', interviewController.createInterview);
interviewRouter.get('/:id', interviewController.getInterviewById);
interviewRouter.get('/:id/questions', interviewController.getInterviewQuestions);

export { interviewRouter };
