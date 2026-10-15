import { Router } from 'express';
import { interviewController } from './interview.controller.js';
import { evaluationController } from '../evaluations/evaluation.controller.js';

const interviewRouter = Router();

interviewRouter.post('/', interviewController.createInterview);
interviewRouter.get('/:id', interviewController.getInterviewById);
interviewRouter.get('/:id/questions', interviewController.getInterviewQuestions);
interviewRouter.post('/:id/start', interviewController.startInterview);
interviewRouter.post('/:interviewId/questions/:questionId/answer', interviewController.submitAnswer);
interviewRouter.post('/:interviewId/questions/:questionId/evaluation', evaluationController.evaluateAnswer);
interviewRouter.get('/:interviewId/questions/:questionId/evaluation', evaluationController.getEvaluation);
interviewRouter.post('/:interviewId/evaluation-report', evaluationController.generateEvaluationReport);
interviewRouter.get('/:interviewId/evaluation-report', evaluationController.getEvaluationReport);

export { interviewRouter };
