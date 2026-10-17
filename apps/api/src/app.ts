import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { healthRouter } from './modules/health/health.route.js';
import { interviewRouter } from './modules/interviews/interview.route.js';
import { authRouter } from './modules/auth/auth.route.js';
import { authConfig } from './modules/auth/auth.config.js';
import { requireTrustedOrigin } from './modules/auth/auth.middleware.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', authConfig.trustProxy);

// Credentialed CORS for the exact frontend origin(s) only (web and API run on different ports).
app.use(cors({
  origin: authConfig.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// Register API routes
app.use('/health', healthRouter);
// CSRF: state-changing API calls must come from an allow-listed origin.
app.use('/api', requireTrustedOrigin);
app.use('/api/auth', authRouter);
app.use('/api/interviews', interviewRouter);

// Last-resort handler: JSON errors only, never stack traces.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  console.error('[API] Unhandled error:', err?.name || 'Error');
  return res.status(500).json({ error: 'Internal server error' });
});

export { app };
