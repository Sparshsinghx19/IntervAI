import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';

// OWASP Password Storage Cheat Sheet baseline for Argon2id.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const SESSION_TOKEN_BYTES = 32;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const passwordHasher = {
  hash: (password: string): Promise<string> => argon2.hash(password, ARGON2_OPTIONS),

  verify: async (hash: string, password: string): Promise<boolean> => {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  },
};

let dummyHashPromise: Promise<string> | null = null;

/**
 * Burns roughly the same time as a real verification so a login for an unknown
 * email is not distinguishable by response time.
 */
export const verifyAgainstDummyHash = async (password: string): Promise<void> => {
  dummyHashPromise ??= passwordHasher.hash('intervai-timing-equaliser');
  await passwordHasher.verify(await dummyHashPromise, password);
};

/** Opaque, unguessable session token (256 bits) sent only in the HttpOnly cookie. */
export const generateSessionToken = (): string => randomBytes(SESSION_TOKEN_BYTES).toString('base64url');

/** One-way hash stored in the database; the raw token is never persisted. */
export const hashSessionToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const isWellFormedSessionToken = (token: string): boolean => SESSION_TOKEN_PATTERN.test(token);
