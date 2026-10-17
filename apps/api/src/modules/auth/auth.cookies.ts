import type { CookieOptions, Request, Response } from 'express';
import { authConfig } from './auth.config.js';
import type { Instant } from './auth.time.js';

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: authConfig.cookieSecure,
  sameSite: authConfig.cookieSameSite,
  path: '/',
  // No `domain`: the cookie stays host-only.
});

export const setSessionCookie = (res: Response, token: string, expiresAt: Instant): void => {
  const expires = new Date(expiresAt.epochMilliseconds);
  res.cookie(authConfig.cookieName, token, {
    ...baseCookieOptions(),
    expires,
  });
};

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(authConfig.cookieName, baseCookieOptions());
};

/** Reads the session cookie from the raw Cookie header (no cookie-parser dependency). */
export const readSessionToken = (req: Request): string | null => {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== authConfig.cookieName) continue;
    const value = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(value) || null;
    } catch {
      return null;
    }
  }
  return null;
};
