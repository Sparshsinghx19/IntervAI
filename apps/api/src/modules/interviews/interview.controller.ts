import { Request, Response } from 'express';
import { interviewService } from './interview.service';

export const interviewController = {
  createInterview: (req: Request, res: Response) => {
    const { title, type, difficulty } = req.body;
    
    // Basic invalid input handling
    if (!title || !type || !difficulty) {
      return res.status(400).json({ error: 'Missing required fields: title, type, difficulty' });
    }
    
    // Call the service
    const newInterview = interviewService.createInterview({ title, type, difficulty });
    
    // Return appropriate JSON response
    res.status(201).json(newInterview);
  }
};
