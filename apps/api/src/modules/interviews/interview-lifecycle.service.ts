import { and } from '@prisma/orm-postgres/orm-client';
import { db } from '../../prisma/db.js';
import { instantFromMs, nowInstant } from '../auth/auth.time.js';

/** Interview length options offered at setup (minutes). */
export const DURATION_OPTIONS = [15, 30, 45, 60] as const;
export const DEFAULT_DURATION_MINUTES = 30;

export const isValidDuration = (value: unknown): value is (typeof DURATION_OPTIONS)[number] =>
  typeof value === 'number' && (DURATION_OPTIONS as readonly number[]).includes(value);

/** Timing information the session page needs; the server clock is authoritative. */
export interface InterviewTiming {
  status: string;
  durationMinutes: number | null;
  startedAt: string | null;
  deadlineAt: string | null;
  completedAt: string | null;
  completionReason: string | null;
  /** Server time when this was produced, so the browser can correct for clock skew. */
  serverNow: string;
}

export class InterviewClosedError extends Error {
  code = 'CONFLICT';
  constructor(public readonly reason: 'TIME_EXPIRED' | 'COMPLETED') {
    super(
      reason === 'TIME_EXPIRED'
        ? 'The time limit for this interview has ended. Only answers submitted before the deadline are evaluated.'
        : 'Interview is already completed'
    );
    this.name = 'InterviewClosedError';
  }
}

const iso = (value: unknown): string | null => (value == null ? null : String(value));

export const toTiming = (row: any): InterviewTiming => ({
  status: row.status,
  durationMinutes: row.durationMinutes ?? null,
  startedAt: iso(row.startedAt),
  deadlineAt: iso(row.deadlineAt),
  completedAt: iso(row.completedAt),
  completionReason: row.completionReason ?? null,
  serverNow: String(nowInstant()),
});

/** `db` or a transaction `tx` (both expose `orm` and `sql`; a transaction runs plans via `query`). */
type Executor = { orm: typeof db.orm; sql: typeof db.sql; query?: (plan: any) => any; runtime?: () => { query: (plan: any) => any } };

/** Runs a plan on `db` or inside a transaction. */
const run = async (ex: Executor, plan: any): Promise<any[]> => {
  const result = typeof ex.query === 'function' ? ex.query(plan) : ex.runtime!().query(plan);
  return (await result) as any[];
};

/*
 * State changes are single `UPDATE … WHERE <condition> RETURNING` statements.
 * Postgres re-checks the condition under the row lock, so two concurrent
 * callers can never both succeed (unlike read-then-write).
 */
export const interviewLifecycle = {
  /**
   * Starts the interview clock exactly once. The first call sets `startedAt`
   * and, for timed interviews, `deadlineAt`; later calls (refresh, resume,
   * a second tab) return the stored values unchanged.
   */
  start: async (interviewId: string, ex: Executor = db): Promise<InterviewTiming | null> => {
    const current = await ex.orm.public.Interview.first({ id: interviewId });
    if (!current) return null;
    if (current.startedAt || current.status === 'COMPLETED') return toTiming(current);

    const now = nowInstant();
    const deadline = current.durationMinutes ? instantFromMs(now.epochMilliseconds + current.durationMinutes * 60_000) : null;
    await run(
      ex,
      ex.sql.public.interview
        .update({ startedAt: now, deadlineAt: deadline, status: 'IN_PROGRESS' })
        .where((f, fns) => fns.and(fns.eq(f.id, interviewId), fns.eq(f.startedAt, null), fns.ne(f.status, 'COMPLETED')))
        .returning('id')
        .build()
    );
    // Whoever won a concurrent start, the stored values are the truth.
    return toTiming(await ex.orm.public.Interview.first({ id: interviewId }));
  },

  /**
   * Finalizes a timed interview whose deadline has passed. Exactly-once: only
   * the first caller gets `true`. Interviews without a deadline (including
   * every legacy interview) never expire.
   */
  expireIfDue: async (interviewId: string, ex: Executor = db): Promise<boolean> => {
    const now = nowInstant();
    const rows = await run(
      ex,
      ex.sql.public.interview
        .update({ status: 'COMPLETED', completedAt: now, completionReason: 'TIME_EXPIRED' })
        .where((f, fns) => fns.and(fns.eq(f.id, interviewId), fns.ne(f.status, 'COMPLETED'), fns.lte(f.deadlineAt, now)))
        .returning('id')
        .build()
    );
    return rows.length > 0;
  },

  /** Expires every overdue interview of one owner (used before listing resumable ones). */
  expireOverdueForOwner: async (ownerId: string, ex: Executor = db): Promise<void> => {
    const now = nowInstant();
    await run(
      ex,
      ex.sql.public.interview
        .update({ status: 'COMPLETED', completedAt: now, completionReason: 'TIME_EXPIRED' })
        .where((f, fns) => fns.and(fns.eq(f.ownerId, ownerId), fns.ne(f.status, 'COMPLETED'), fns.lte(f.deadlineAt, now)))
        .returning('id')
        .build()
    );
  },

  /**
   * Call first inside a submission transaction. Atomically confirms the
   * interview is open and before its deadline, and row-locks it until commit,
   * so a concurrent expiry waits for this submission (or vice versa).
   */
  lockOpenForSubmission: async (tx: Executor, interviewId: string): Promise<void> => {
    const now = nowInstant();
    const rows = await run(
      tx,
      tx.sql.public.interview
        .update({ status: 'IN_PROGRESS' })
        .where((f, fns) =>
          fns.and(
            fns.eq(f.id, interviewId),
            fns.ne(f.status, 'COMPLETED'),
            fns.or(fns.eq(f.deadlineAt, null), fns.gt(f.deadlineAt, now))
          )
        )
        .returning('id')
        .build()
    );
    if (rows.length > 0) return;

    const row = await tx.orm.public.Interview.first({ id: interviewId });
    if (!row) {
      const err = new Error('Interview not found');
      (err as any).code = 'NOT_FOUND';
      throw err;
    }
    throw new InterviewClosedError(row.status === 'COMPLETED' && row.completionReason !== 'TIME_EXPIRED' ? 'COMPLETED' : 'TIME_EXPIRED');
  },

  /**
   * Records that every question was answered. Runs inside the submission
   * transaction, which already holds the interview row lock.
   */
  markAllAnswered: async (tx: { orm: typeof db.orm }, interviewId: string): Promise<void> => {
    await tx.orm.public.Interview
      .where((i) => and(i.id.eq(interviewId), i.status.neq('COMPLETED')))
      .update({ status: 'COMPLETED', completedAt: nowInstant(), completionReason: 'ALL_ANSWERED' });
  },

  /** Throws InterviewClosedError if the interview is finished or past its deadline (no lock; use before slow work). */
  assertOpen: async (interviewId: string): Promise<void> => {
    await interviewLifecycle.expireIfDue(interviewId);
    const current = await db.orm.public.Interview.first({ id: interviewId });
    if (current?.status === 'COMPLETED') {
      throw new InterviewClosedError(current.completionReason === 'TIME_EXPIRED' ? 'TIME_EXPIRED' : 'COMPLETED');
    }
  },
};
