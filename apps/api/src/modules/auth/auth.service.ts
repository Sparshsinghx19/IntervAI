import { authConfig } from './auth.config.js';
import {
  generateSessionToken,
  hashSessionToken,
  isWellFormedSessionToken,
  passwordHasher,
  verifyAgainstDummyHash,
} from './auth.crypto.js';
import { authRepository, DuplicateEmailError, UserRecord } from './auth.repository.js';
import { AuthError, AuthPrincipal, PublicUser } from './auth.types.js';
import { Instant, instantFromMs, nowInstant } from './auth.time.js';

export interface IssuedSession {
  /** Raw token: goes into the cookie only, never into a response body or log. */
  token: string;
  expiresAt: Instant;
}

export const toPublicUser = (user: UserRecord): PublicUser => ({
  id: user.id,
  name: user.displayName,
  email: user.email,
  role: user.role,
});

const now = (): Instant => nowInstant();

const newSessionMaterial = () => {
  const token = generateSessionToken();
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: instantFromMs(Date.now() + authConfig.sessionTtlMs),
  };
};

export const authService = {
  register: async (input: { name: string; email: string; password: string }): Promise<{
    user: PublicUser;
    session: IssuedSession;
  }> => {
    // Hash before touching the database so no transaction waits on Argon2.
    const passwordHash = await passwordHasher.hash(input.password);

    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) {
      throw new AuthError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Try logging in instead.');
    }

    const material = newSessionMaterial();
    try {
      const { user } = await authRepository.createUserWithSession(
        { email: input.email, displayName: input.name, passwordHash },
        { tokenHash: material.tokenHash, expiresAt: material.expiresAt }
      );
      return { user: toPublicUser(user), session: { token: material.token, expiresAt: material.expiresAt } };
    } catch (err) {
      // Lost a race with a concurrent registration for the same email.
      if (err instanceof DuplicateEmailError) {
        throw new AuthError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Try logging in instead.');
      }
      throw err;
    }
  },

  login: async (input: { email: string; password: string }, previousToken?: string | null): Promise<{
    user: PublicUser;
    session: IssuedSession;
  }> => {
    const user = await authRepository.findUserByEmail(input.email);
    const valid = user
      ? await passwordHasher.verify(user.passwordHash, input.password)
      : (await verifyAgainstDummyHash(input.password), false);

    if (!user || !valid) {
      throw new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    // Never reuse a token presented before login (session fixation): revoke it and mint a new one.
    if (previousToken && isWellFormedSessionToken(previousToken)) {
      await authRepository.revokeSessionByTokenHash(hashSessionToken(previousToken), now());
    }

    const material = newSessionMaterial();
    await authRepository.createSession(user.id, material.tokenHash, material.expiresAt);
    return { user: toPublicUser(user), session: { token: material.token, expiresAt: material.expiresAt } };
  },

  logout: async (token: string | null | undefined): Promise<void> => {
    if (!token || !isWellFormedSessionToken(token)) return;
    await authRepository.revokeSessionByTokenHash(hashSessionToken(token), now());
  },

  /** Resolves a raw cookie token to a principal, or null if the session is unknown, revoked or expired. */
  resolveSession: async (token: string | null | undefined): Promise<AuthPrincipal | null> => {
    if (!token || !isWellFormedSessionToken(token)) return null;

    const session = await authRepository.findSessionByTokenHash(hashSessionToken(token));
    if (!session || session.revokedAt) return null;

    const current = now();
    if (session.expiresAt.epochMilliseconds <= current.epochMilliseconds) return null;

    const user = await authRepository.findUserById(session.userId);
    if (!user) return null;

    if (current.epochMilliseconds - session.lastUsedAt.epochMilliseconds > authConfig.sessionTouchIntervalMs) {
      // Best effort: a failed activity timestamp must not fail the request.
      authRepository.touchSession(session.id, current).catch(() => undefined);
    }

    return {
      userId: user.id,
      sessionId: session.id,
      name: user.displayName,
      email: user.email,
      role: user.role,
    };
  },
};
