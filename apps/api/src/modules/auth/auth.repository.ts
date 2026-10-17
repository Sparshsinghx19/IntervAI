import { db } from '../../prisma/db.js';
import type { UserRole } from './auth.types.js';
import type { Instant } from './auth.time.js';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Instant;
  revokedAt: Instant | null;
  lastUsedAt: Instant;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'DuplicateEmailError';
  }
}

const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { sqlState?: string; code?: string; cause?: { code?: string } } | null;
  return e?.sqlState === '23505' || e?.code === '23505' || e?.cause?.code === '23505';
};

const toUserRecord = (row: any): UserRecord => ({
  id: row.id,
  email: row.email,
  displayName: row.displayName,
  passwordHash: row.passwordHash,
  role: row.role === 'ADMIN' ? 'ADMIN' : 'USER',
});

const toSessionRecord = (row: any): SessionRecord => ({
  id: row.id,
  userId: row.userId,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt ?? null,
  lastUsedAt: row.lastUsedAt,
});

/**
 * Thin persistence layer for users and sessions. Every method is a single short
 * statement or transaction; none of them wait on hashing or network calls.
 */
export const authRepository = {
  findUserByEmail: async (email: string): Promise<UserRecord | null> => {
    const row = await db.orm.public.User.where({ email }).first();
    return row ? toUserRecord(row) : null;
  },

  findUserById: async (id: string): Promise<UserRecord | null> => {
    const row = await db.orm.public.User.first({ id });
    return row ? toUserRecord(row) : null;
  },

  /** Creates the user and its first session atomically. Role is always the default. */
  createUserWithSession: async (
    user: { email: string; displayName: string; passwordHash: string },
    session: { tokenHash: string; expiresAt: Instant }
  ): Promise<{ user: UserRecord; session: SessionRecord }> => {
    try {
      return await db.transaction(async (tx) => {
        const createdUser = await tx.orm.public.User.create({
          email: user.email,
          displayName: user.displayName,
          passwordHash: user.passwordHash,
        });
        const createdSession = await tx.orm.public.AuthSession.create({
          userId: createdUser.id,
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
        });
        return { user: toUserRecord(createdUser), session: toSessionRecord(createdSession) };
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new DuplicateEmailError();
      throw err;
    }
  },

  createSession: async (userId: string, tokenHash: string, expiresAt: Instant): Promise<SessionRecord> => {
    const row = await db.orm.public.AuthSession.create({ userId, tokenHash, expiresAt });
    return toSessionRecord(row);
  },

  findSessionByTokenHash: async (tokenHash: string): Promise<SessionRecord | null> => {
    const row = await db.orm.public.AuthSession.where({ tokenHash }).first();
    return row ? toSessionRecord(row) : null;
  },

  /** Marks an active session as revoked. Already revoked or missing sessions are left alone. */
  revokeSessionByTokenHash: async (tokenHash: string, at: Instant): Promise<void> => {
    await db.orm.public.AuthSession
      .where((s) => s.tokenHash.eq(tokenHash))
      .where((s) => s.revokedAt.isNull())
      .update({ revokedAt: at });
  },

  touchSession: async (sessionId: string, at: Instant): Promise<void> => {
    await db.orm.public.AuthSession.where({ id: sessionId }).update({ lastUsedAt: at });
  },
};
