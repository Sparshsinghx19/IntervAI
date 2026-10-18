import express, { Router } from 'express';
import { interviewController } from './interview.controller.js';
import { evaluationController } from '../evaluations/evaluation.controller.js';
import { codingController } from '../coding/coding.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireInterviewOwnership } from '../auth/interview-access.js';
import { createRateLimiter } from '../auth/rate-limit.js';
import { DOCX_MIME, PDF_MIME, RESUME_MAX_FILE_BYTES } from './resume-intake.service.js';
import { TRANSCRIBE_MAX_BYTES, WAV_MIME_TYPES } from './answer-transcription.service.js';

const interviewRouter = Router();

// Every interview route needs a signed-in user; routes that address an
// interview additionally require that the user owns it.
interviewRouter.use(requireAuth);

const ownsId = requireInterviewOwnership('id');

// Each resume parse calls the model; bound it per signed-in user.
export const resumeParseLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  key: (req) => (req.principal ? `resume:${req.principal.userId}` : null),
});
// Each transcription calls the model; bound it per signed-in user.
export const transcribeLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  key: (req) => (req.principal ? `transcribe:${req.principal.userId}` : null),
});
const ownsInterview = requireInterviewOwnership('interviewId');

interviewRouter.post('/', interviewController.createInterview);
// Static paths: must stay above '/:id' so they are not read as interview ids.
interviewRouter.get('/history', interviewController.getInterviewHistory);
interviewRouter.get('/summary', interviewController.getDashboardSummary);
interviewRouter.get('/in-progress', interviewController.getInProgressInterviews);
interviewRouter.post(
  '/resume/parse',
  resumeParseLimiter,
  // PDF/DOCX arrive as a raw body (JSON {text} is parsed by the global JSON parser).
  express.raw({ type: [PDF_MIME, DOCX_MIME], limit: RESUME_MAX_FILE_BYTES }),
  interviewController.parseResume
);
interviewRouter.get('/:id', ownsId, interviewController.getInterviewById);
interviewRouter.get('/:id/questions', ownsId, interviewController.getInterviewQuestions);
interviewRouter.get('/:id/progress', ownsId, interviewController.getInterviewProgress);
interviewRouter.post('/:id/start', ownsId, interviewController.startInterview);
interviewRouter.post('/:id/finalize', ownsId, interviewController.finalizeInterview);
interviewRouter.post(
  '/:id/transcribe',
  ownsId,
  transcribeLimiter,
  // WAV audio arrives as a raw body; it is held in memory for this request only.
  express.raw({ type: WAV_MIME_TYPES, limit: TRANSCRIBE_MAX_BYTES }),
  interviewController.transcribeAnswer
);
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
