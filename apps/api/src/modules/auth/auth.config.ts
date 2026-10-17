import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export type SameSiteSetting = 'lax' | 'strict' | 'none';

export interface AuthConfig {
  isProduction: boolean;
  /** Exact browser origins allowed to make credentialed requests (CORS + CSRF origin check). */
  allowedOrigins: string[];
  cookieName: string;
  cookieSecure: boolean;
  cookieSameSite: SameSiteSetting;
  sessionTtlMs: number;
  /** Minimum gap between lastUsedAt writes for the same session. */
  sessionTouchIntervalMs: number;
  /** Value passed to Express "trust proxy"; false means use the socket address. */
  trustProxy: boolean | number | string;
}

const DEFAULT_SESSION_TTL_HOURS = 24 * 7;

const parseOrigins = (raw: string | undefined): string[] => {
  const list = (raw || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  for (const origin of list) {
    if (origin === '*') {
      throw new Error('Configuration Error: FRONTEND_ORIGINS cannot contain "*" when credentials are enabled.');
    }
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Configuration Error: FRONTEND_ORIGINS entry '${origin}' is not a valid origin.`);
    }
    if (parsed.origin !== origin) {
      throw new Error(`Configuration Error: FRONTEND_ORIGINS entry '${origin}' must be a bare origin (scheme://host[:port]).`);
    }
  }
  return list;
};

const parseSameSite = (raw: string | undefined): SameSiteSetting => {
  const value = (raw || 'lax').trim().toLowerCase();
  if (value === 'lax' || value === 'strict' || value === 'none') return value;
  throw new Error(`Configuration Error: AUTH_COOKIE_SAMESITE must be one of lax, strict, none.`);
};

const parseTtlMs = (raw: string | undefined): number => {
  if (!raw || raw.trim() === '') return DEFAULT_SESSION_TTL_HOURS * 60 * 60 * 1000;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 90) {
    throw new Error('Configuration Error: AUTH_SESSION_TTL_HOURS must be a number between 0 and 2160.');
  }
  return Math.round(hours * 60 * 60 * 1000);
};

const parseTrustProxy = (raw: string | undefined): boolean | number | string => {
  if (!raw || raw.trim() === '' || raw === 'false') return false;
  if (raw === 'true') return true;
  const asNumber = Number(raw);
  return Number.isInteger(asNumber) ? asNumber : raw.trim();
};

export const loadAuthConfig = (env: NodeJS.ProcessEnv = process.env): AuthConfig => {
  const isProduction = env.NODE_ENV === 'production';
  const cookieSameSite = parseSameSite(env.AUTH_COOKIE_SAMESITE);
  // SameSite=None is only honoured by browsers on Secure cookies.
  const cookieSecure = isProduction || cookieSameSite === 'none';

  return {
    isProduction,
    allowedOrigins: parseOrigins(env.FRONTEND_ORIGINS),
    // The __Host- prefix pins the cookie to this exact host, path "/" and Secure.
    cookieName: cookieSecure ? '__Host-intervai_session' : 'intervai_session',
    cookieSecure,
    cookieSameSite,
    sessionTtlMs: parseTtlMs(env.AUTH_SESSION_TTL_HOURS),
    sessionTouchIntervalMs: 5 * 60 * 1000,
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
  };
};

export const authConfig: Readonly<AuthConfig> = Object.freeze(loadAuthConfig());
