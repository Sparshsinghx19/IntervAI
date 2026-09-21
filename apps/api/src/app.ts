import express from 'express';
import cors from 'cors';
import { healthRouter } from './modules/health/health.route';
import { interviewRouter } from './modules/interviews/interview.route';

const app = express();

// Enable CORS so the Next.js frontend (on port 3000) can request data
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Register API routes
app.use('/health', healthRouter);
app.use('/api/interviews', interviewRouter);

export { app };
