import { Router } from 'express';
import { interviewController } from './interview.controller.js';

const interviewRouter = Router();

interviewRouter.post('/', interviewController.createInterview);
interviewRouter.get('/:id', interviewController.getInterviewById);
interviewRouter.get('/:id/questions', interviewController.getInterviewQuestions);
interviewRouter.post('/:id/start', interviewController.startInterview);
interviewRouter.post('/:interviewId/questions/:questionId/answer', interviewController.submitAnswer);

export { interviewRouter };
