import { Request, Response } from 'express';
import { healthService } from './health.service.js';

export const healthController = {
  getHealth: (req: Request, res: Response) => {
    const status = healthService.checkHealth();
    res.json(status);
  },

  getReady: async (_req: Request, res: Response) => {
    const ready = await healthService.checkReady();
    res.status(ready.status === 'ok' ? 200 : 503).json(ready);
  },
};
