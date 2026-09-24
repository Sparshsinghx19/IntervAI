import { Request, Response } from 'express';
import { healthService } from './health.service.js';

export const healthController = {
  getHealth: (req: Request, res: Response) => {
    const status = healthService.checkHealth();
    res.json(status);
  }
};
