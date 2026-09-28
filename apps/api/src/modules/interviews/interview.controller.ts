import { Request, Response } from 'express';
import { interviewService } from './interview.service.js';

const VALID_TYPES = ['TECHNICAL', 'BEHAVIORAL', 'HR'] as const;
const VALID_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

type InterviewType = typeof VALID_TYPES[number];
type InterviewDifficulty = typeof VALID_DIFFICULTIES[number];

const typeMap: Record<string, InterviewType> = {
  technical: 'TECHNICAL',
  behavioral: 'BEHAVIORAL',
  hr: 'HR',
  TECHNICAL: 'TECHNICAL',
  BEHAVIORAL: 'BEHAVIORAL',
  HR: 'HR',
};

const difficultyMap: Record<string, InterviewDifficulty> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
};

export const interviewController = {
  createInterview: async (req: Request, res: Response) => {
    try {
      const { type, difficulty, focusArea, questionCount } = req.body;
      
      // Basic invalid input handling
      if (!type || !difficulty || !focusArea || questionCount === undefined) {
        return res.status(400).json({ error: 'Missing required fields: type, difficulty, focusArea, questionCount' });
      }

      if (typeof questionCount !== 'number' || questionCount <= 0 || !Number.isInteger(questionCount)) {
        return res.status(400).json({ error: 'questionCount must be a positive integer' });
      }

      const normalizedType = typeMap[String(type).toLowerCase()];
      if (!normalizedType) {
        return res.status(400).json({ error: `Invalid type. Must be one of: TECHNICAL, BEHAVIORAL, HR` });
      }

      const normalizedDifficulty = difficultyMap[String(difficulty).toLowerCase()];
      if (!normalizedDifficulty) {
        return res.status(400).json({ error: `Invalid difficulty. Must be one of: EASY, MEDIUM, HARD` });
      }

      // Call the service
      const newInterview = await interviewService.createInterview({ 
        type: normalizedType, 
        difficulty: normalizedDifficulty,
        focusArea: String(focusArea),
        questionCount,
      });
      
      // Return appropriate JSON response
      res.status(201).json(newInterview);
    } catch (error) {
      console.error('Failed to create interview:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getInterviewById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Interview ID is required and must be a string' });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid Interview ID format' });
      }

      const interview = await interviewService.getInterviewById(id as string);

      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      res.status(200).json(interview);
    } catch (error) {
      console.error('Failed to get interview by ID:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getInterviewQuestions: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Interview ID is required and must be a string' });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid Interview ID format' });
      }

      // First check if the interview exists
      const interview = await interviewService.getInterviewById(id as string);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      // Get questions
      const questions = await interviewService.getInterviewQuestions(id as string);
      
      res.status(200).json({ questions });
    } catch (error) {
      console.error('Failed to get interview questions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  startInterview: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Interview ID is required and must be a string' });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid Interview ID format' });
      }

      const interview = await interviewService.startInterview(id);
      res.status(200).json(interview);
    } catch (error: any) {
      console.error('Failed to start interview:', error);
      if (error.message === 'Interview not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Interview cannot be started from this state') {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  submitAnswer: async (req: Request, res: Response) => {
    try {
      const { interviewId, questionId } = req.params;
      const { answerText } = req.body;

      if (!interviewId || !questionId) {
        return res.status(400).json({ error: 'Interview ID and Question ID are required' });
      }
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(interviewId as string) || !uuidRegex.test(questionId as string)) {
        return res.status(400).json({ error: 'Invalid UUID format' });
      }

      if (!answerText || typeof answerText !== 'string' || answerText.trim() === '') {
        return res.status(400).json({ error: 'answerText is required and must be a non-empty string' });
      }

      const answer = await interviewService.submitAnswer(interviewId as string, questionId as string, answerText);
      
      res.status(201).json(answer);
    } catch (error: any) {
      console.error('Failed to submit answer:', error);
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      if (error.code === 'CONFLICT') {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
