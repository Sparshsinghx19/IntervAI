import { Router } from 'express';
import { authController } from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';
import { normalizeEmail } from './auth.validation.js';
import { clientIp, createRateLimiter } from './rate-limit.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export const authRateLimiters = {
  loginByIp: createRateLimiter({ windowMs: FIFTEEN_MINUTES, max: 20, key: (req) => `ip:${clientIp(req)}` }),
  loginByAccount: createRateLimiter({
    windowMs: FIFTEEN_MINUTES,
    max: 10,
    key: (req) => (typeof req.body?.email === 'string' ? `email:${normalizeEmail(req.body.email)}` : null),
  }),
  registerByIp: createRateLimiter({ windowMs: ONE_HOUR, max: 10, key: (req) => `ip:${clientIp(req)}` }),
};

const authRouter = Router();

authRouter.post('/register', authRateLimiters.registerByIp, authController.register);
authRouter.post('/login', authRateLimiters.loginByIp, authRateLimiters.loginByAccount, authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);

export { authRouter };
