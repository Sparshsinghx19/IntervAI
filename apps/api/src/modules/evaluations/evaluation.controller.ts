import { Request, Response } from 'express';
import { evaluationService } from './evaluation.service.js';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const evaluationController = {
  evaluateAnswer: async (req: Request, res: Response) => {
    try {
      const { interviewId, questionId } = req.params;

      if (!interviewId || !questionId) {
        return res.status(400).json({ error: 'Interview ID and Question ID are required' });
      }

      if (!uuidRegex.test(String(interviewId)) || !uuidRegex.test(String(questionId))) {
        return res.status(400).json({ error: 'Invalid UUID format for interviewId or questionId' });
      }

      const evaluation = await evaluationService.evaluateAnswer(
        String(interviewId),
        String(questionId)
      );

      res.status(200).json(evaluation);
    } catch (error: any) {
      console.error('Failed to evaluate answer:', error);
      if (error?.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      if (error?.code === 'CONFLICT') {
        return res.status(409).json({ error: error.message });
      }
      if (error?.code === 'PROVIDER_ERROR') {
        return res.status(503).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getEvaluation: async (req: Request, res: Response) => {
    try {
      const { interviewId, questionId } = req.params;

      if (!interviewId || !questionId) {
        return res.status(400).json({ error: 'Interview ID and Question ID are required' });
      }

      if (!uuidRegex.test(String(interviewId)) || !uuidRegex.test(String(questionId))) {
        return res.status(400).json({ error: 'Invalid UUID format for interviewId or questionId' });
      }

      const evaluation = await evaluationService.getEvaluation(
        String(interviewId),
        String(questionId)
      );

      if (!evaluation) {
        return res.status(404).json({ error: 'Evaluation not found for this answer' });
      }

      res.status(200).json(evaluation);
    } catch (error: any) {
      console.error('Failed to get evaluation:', error);
      if (error?.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  generateEvaluationReport: async (req: Request, res: Response) => {
    try {
      const { interviewId } = req.params;

      if (!interviewId) {
        return res.status(400).json({ error: 'Interview ID is required' });
      }

      if (!uuidRegex.test(String(interviewId))) {
        return res.status(400).json({ error: 'Invalid UUID format for interviewId' });
      }

      const report = await evaluationService.generateEvaluationReport(String(interviewId));
      res.status(200).json(report);
    } catch (error: any) {
      console.error('Failed to generate evaluation report:', error);
      if (error?.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      if (error?.code === 'BAD_REQUEST') {
        return res.status(400).json({ error: error.message });
      }
      if (error?.code === 'CONFLICT') {
        return res.status(409).json({ error: error.message });
      }
      if (error?.code === 'RATE_LIMITED') {
        return res.status(429).json({ error: error.message });
      }
      if (error?.code === 'PROVIDER_UNAVAILABLE' || error?.code === 'PROVIDER_ERROR' || error?.code === 'NETWORK_ERROR') {
        return res.status(503).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getEvaluationReport: async (req: Request, res: Response) => {
    try {
      const { interviewId } = req.params;

      if (!interviewId) {
        return res.status(400).json({ error: 'Interview ID is required' });
      }

      if (!uuidRegex.test(String(interviewId))) {
        return res.status(400).json({ error: 'Invalid UUID format for interviewId' });
      }

      const report = await evaluationService.getEvaluationReport(String(interviewId));

      if (!report) {
        return res.status(404).json({ error: 'Evaluation report not found for this interview' });
      }

      res.status(200).json(report);
    } catch (error: any) {
      console.error('Failed to get evaluation report:', error);
      if (error?.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

