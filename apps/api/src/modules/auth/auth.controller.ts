import type { Request, Response } from 'express';
import { clearSessionCookie, readSessionToken, setSessionCookie } from './auth.cookies.js';
import { authService } from './auth.service.js';
import { AuthError } from './auth.types.js';
import { validateLogin, validateRegistration } from './auth.validation.js';

// Logs only the error class, never the error object: driver errors can echo
// parameters (emails, hashes) back in their detail fields.
const logFailure = (action: string, err: any) => {
  console.error(`[Auth] ${action} failed:`, err?.name || 'Error', err?.sqlState || err?.code || '');
};

const sendFailure = (res: Response, action: string, err: unknown) => {
  if (err instanceof AuthError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  logFailure(action, err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

export const authController = {
  register: async (req: Request, res: Response) => {
    const parsed = validateRegistration(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'Please correct the highlighted fields.', fieldErrors: parsed.fieldErrors });
    }

    try {
      const { user, session } = await authService.register(parsed.value);
      setSessionCookie(res, session.token, session.expiresAt);
      return res.status(201).json({ user });
    } catch (err) {
      return sendFailure(res, 'Registration', err);
    }
  },

  login: async (req: Request, res: Response) => {
    const parsed = validateLogin(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'Please correct the highlighted fields.', fieldErrors: parsed.fieldErrors });
    }

    try {
      const { user, session } = await authService.login(parsed.value, readSessionToken(req));
      setSessionCookie(res, session.token, session.expiresAt);
      return res.status(200).json({ user });
    } catch (err) {
      return sendFailure(res, 'Login', err);
    }
  },

  logout: async (req: Request, res: Response) => {
    try {
      await authService.logout(readSessionToken(req));
    } catch (err) {
      // The cookie is still cleared below; the stale row expires on its own.
      logFailure('Logout', err);
    }
    clearSessionCookie(res);
    return res.status(204).end();
  },

  me: (req: Request, res: Response) => {
    const principal = req.principal;
    if (!principal) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.status(200).json({
      user: {
        id: principal.userId,
        name: principal.name,
        email: principal.email,
        role: principal.role,
      },
    });
  },
};
