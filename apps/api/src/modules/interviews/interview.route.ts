import { Router } from 'express';
import { interviewController } from './interview.controller.js';
import { evaluationController } from '../evaluations/evaluation.controller.js';
import { codingController } from '../coding/coding.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireInterviewOwnership } from '../auth/interview-access.js';

const interviewRouter = Router();

// Every interview route needs a signed-in user; routes that address an
// interview additionally require that the user owns it.
interviewRouter.use(requireAuth);

const ownsId = requireInterviewOwnership('id');
const ownsInterview = requireInterviewOwnership('interviewId');

interviewRouter.post('/', interviewController.createInterview);
// Static paths: must stay above '/:id' so they are not read as interview ids.
interviewRouter.get('/history', interviewController.getInterviewHistory);
interviewRouter.get('/summary', interviewController.getDashboardSummary);
interviewRouter.get('/:id', ownsId, interviewController.getInterviewById);
interviewRouter.get('/:id/questions', ownsId, interviewController.getInterviewQuestions);
interviewRouter.post('/:id/start', ownsId, interviewController.startInterview);
interviewRouter.post('/:interviewId/questions/:questionId/answer', ownsInterview, interviewController.submitAnswer);
interviewRouter.post('/:interviewId/questions/:questionId/evaluation', ownsInterview, evaluationController.evaluateAnswer);
interviewRouter.get('/:interviewId/questions/:questionId/evaluation', ownsInterview, evaluationController.getEvaluation);
interviewRouter.post('/:interviewId/evaluation-report', ownsInterview, evaluationController.generateEvaluationReport);
interviewRouter.get('/:interviewId/evaluation-report', ownsInterview, evaluationController.getEvaluationReport);

// Coding Execution Engine Routes
interviewRouter.get('/:interviewId/questions/:questionId/coding-problem', ownsInterview, codingController.getCodingProblem);
interviewRouter.post('/:interviewId/questions/:questionId/code/run', ownsInterview, codingController.runCode);
interviewRouter.post('/:interviewId/questions/:questionId/code/submit', ownsInterview, codingController.submitSolution);

export { interviewRouter };
