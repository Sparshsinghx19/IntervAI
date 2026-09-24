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
  }
};
