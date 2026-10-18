import { Request, Response } from 'express';
import { codingService } from './coding.service.js';
import { RunnerUnavailableError } from './judge0.service.js';
import { SupportedLanguage } from './coding.types.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_LANGUAGES: readonly SupportedLanguage[] = ['cpp', 'python', 'java'];

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

export const codingController = {
  /**
   * GET /api/interviews/:interviewId/questions/:questionId/coding-problem
   */
  getCodingProblem: async (req: Request, res: Response) => {
    try {
      const interviewId = getParam(req.params.interviewId);
      const questionId = getParam(req.params.questionId);

      if (!interviewId || !UUID_REGEX.test(interviewId)) {
        return res.status(400).json({ error: 'Invalid interview ID format' });
      }
      if (!questionId || !UUID_REGEX.test(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID format' });
      }

      const result = await codingService.getCodingProblem(interviewId, questionId);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err instanceof RunnerUnavailableError) {
        return res.status(503).json({ error: err.message });
      }
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message });
      }
      if (err.code === 'CONFLICT') {
        return res.status(409).json({ error: err.message, reason: err.reason ?? 'COMPLETED' });
      }
      if (err.code === 'BAD_REQUEST') {
        return res.status(400).json({ error: err.message });
      }
      console.error('[CodingController] Error in getCodingProblem:', err);
      return res.status(500).json({ error: 'Failed to retrieve coding problem' });
    }
  },

  /**
   * POST /api/interviews/:interviewId/questions/:questionId/code/run
   */
  runCode: async (req: Request, res: Response) => {
    try {
      const interviewId = getParam(req.params.interviewId);
      const questionId = getParam(req.params.questionId);
      const { language, sourceCode } = req.body;

      if (!interviewId || !UUID_REGEX.test(interviewId)) {
        return res.status(400).json({ error: 'Invalid interview ID format' });
      }
      if (!questionId || !UUID_REGEX.test(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID format' });
      }

      if (!language || !ALLOWED_LANGUAGES.includes(language as SupportedLanguage)) {
        return res.status(400).json({
          error: `Invalid language '${language}'. Supported languages: ${ALLOWED_LANGUAGES.join(', ')}`,
        });
      }

      if (typeof sourceCode !== 'string' || sourceCode.trim() === '') {
        return res.status(400).json({ error: 'Source code cannot be empty' });
      }

      if (sourceCode.length > 64 * 1024) {
        return res.status(400).json({ error: 'Source code exceeds maximum size limit (64KB)' });
      }

      const result = await codingService.runCode({
        interviewId,
        questionId,
        language: language as SupportedLanguage,
        sourceCode,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      if (err instanceof RunnerUnavailableError) {
        return res.status(503).json({ error: err.message });
      }
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message });
      }
      if (err.code === 'CONFLICT') {
        return res.status(409).json({ error: err.message, reason: err.reason ?? 'COMPLETED' });
      }
      if (err.code === 'BAD_REQUEST') {
        return res.status(400).json({ error: err.message });
      }
      console.error('[CodingController] Error running code:', err);
      return res.status(500).json({ error: 'Internal code runner error occurred' });
    }
  },

  /**
   * POST /api/interviews/:interviewId/questions/:questionId/code/submit
   */
  submitSolution: async (req: Request, res: Response) => {
    try {
      const interviewId = getParam(req.params.interviewId);
      const questionId = getParam(req.params.questionId);
      const { language, sourceCode } = req.body;

      if (!interviewId || !UUID_REGEX.test(interviewId)) {
        return res.status(400).json({ error: 'Invalid interview ID format' });
      }
      if (!questionId || !UUID_REGEX.test(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID format' });
      }

      if (!language || !ALLOWED_LANGUAGES.includes(language as SupportedLanguage)) {
        return res.status(400).json({
          error: `Invalid language '${language}'. Supported languages: ${ALLOWED_LANGUAGES.join(', ')}`,
        });
      }

      if (typeof sourceCode !== 'string' || sourceCode.trim() === '') {
        return res.status(400).json({ error: 'Source code cannot be empty' });
      }

      if (sourceCode.length > 64 * 1024) {
        return res.status(400).json({ error: 'Source code exceeds maximum size limit (64KB)' });
      }

      const result = await codingService.submitSolution({
        interviewId,
        questionId,
        language: language as SupportedLanguage,
        sourceCode,
      });

      return res.status(201).json(result);
    } catch (err: any) {
      if (err instanceof RunnerUnavailableError) {
        return res.status(503).json({ error: err.message });
      }
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message });
      }
      if (err.code === 'CONFLICT') {
        return res.status(409).json({ error: err.message, reason: err.reason ?? 'COMPLETED' });
      }
      if (err.code === 'BAD_REQUEST') {
        return res.status(400).json({ error: err.message });
      }
      console.error('[CodingController] Error submitting code:', err);
      return res.status(500).json({ error: 'Internal error processing submission' });
    }
  },
};
