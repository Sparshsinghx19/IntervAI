import type { NextFunction, Request, Response } from 'express';
import { authConfig } from './auth.config.js';
import { clearSessionCookie, readSessionToken } from './auth.cookies.js';
import { authService } from './auth.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rejects the request with 401 unless it carries a valid, unexpired, unrevoked
 * session cookie. On success `req.principal` holds the server-resolved user.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = readSessionToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const principal = await authService.resolveSession(token);
    if (!principal) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }
    req.principal = principal;
    return next();
  } catch (err: any) {
    console.error('[Auth] Session lookup failed:', err?.name || 'Error');
    return res.status(503).json({ error: 'Authentication service is temporarily unavailable.' });
  }
};

const originOf = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * CSRF defence for cookie-authenticated requests: every state-changing request
 * must come from an allow-listed browser origin. CORS alone does not stop a
 * cross-site form POST from being sent with cookies, this check does.
 */
export const createOriginCheck = (allowedOrigins: readonly string[]) => {
  const allowed = new Set(allowedOrigins);

  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.headers.origin;
    const source = origin && origin !== 'null' ? originOf(origin) : originOf(req.headers.referer);

    if (!source || !allowed.has(source)) {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    return next();
  };
};

export const requireTrustedOrigin = createOriginCheck(authConfig.allowedOrigins);
