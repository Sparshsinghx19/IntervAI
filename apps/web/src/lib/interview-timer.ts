import { API_URL, apiFetch } from './api-client';

/** Server-side timing for an interview (see the API's interview-lifecycle service). */
export interface InterviewTiming {
  status: string;
  durationMinutes: number | null;
  startedAt: string | null;
  deadlineAt: string | null;
  completedAt: string | null;
  completionReason: string | null;
  serverNow: string;
}

export const DURATION_OPTIONS = [15, 30, 45, 60] as const;
export const DEFAULT_DURATION_MINUTES = 30;

type FetchFn = typeof fetch;

export function parseTiming(raw: unknown): InterviewTiming | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  if (typeof r.status !== 'string' || typeof r.serverNow !== 'string') return null;
  return {
    status: r.status,
    durationMinutes: typeof r.durationMinutes === 'number' ? r.durationMinutes : null,
    startedAt: str(r.startedAt),
    deadlineAt: str(r.deadlineAt),
    completedAt: str(r.completedAt),
    completionReason: str(r.completionReason),
    serverNow: r.serverNow,
  };
}

/**
 * Difference between the server clock and this browser's clock, measured when
 * timing was received. The countdown uses it so a wrong local clock cannot
 * shorten or extend the interview (the server enforces the deadline anyway).
 */
export const clockOffsetMs = (timing: InterviewTiming, receivedAtMs: number): number => {
  const server = Date.parse(timing.serverNow);
  return Number.isNaN(server) ? 0 : server - receivedAtMs;
};

/** Milliseconds left before the deadline, or null for untimed interviews. */
export function remainingMs(timing: InterviewTiming | null, offsetMs: number, nowMs: number): number | null {
  if (!timing?.deadlineAt) return null;
  const deadline = Date.parse(timing.deadlineAt);
  if (Number.isNaN(deadline)) return null;
  return Math.max(0, deadline - (nowMs + offsetMs));
}

export type TimeWarning = 'none' | 'five-minutes' | 'one-minute' | 'expired';

export function timeWarning(remaining: number | null): TimeWarning {
  if (remaining === null) return 'none';
  if (remaining <= 0) return 'expired';
  if (remaining <= 60_000) return 'one-minute';
  if (remaining <= 5 * 60_000) return 'five-minutes';
  return 'none';
}

/** "mm:ss" (or "h:mm:ss" past an hour), rounding up so 0:00 means time is truly up. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Starts the interview clock on the server (idempotent: returns the original deadline on refresh/resume). */
export async function startInterviewClock(
  interviewId: string,
  { fetchFn = apiFetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<InterviewTiming | null> {
  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/${encodeURIComponent(interviewId)}/start`, { method: 'POST' });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { timing?: unknown } | null;
    return parseTiming(body?.timing);
  } catch {
    return null;
  }
}

/**
 * Asks the server to close a timed interview whose deadline has passed.
 * Returns 'finalized' once the server agrees, 'not-yet' if its clock says
 * time remains, or 'error'.
 */
export async function finalizeInterview(
  interviewId: string,
  { fetchFn = apiFetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<{ result: 'finalized' | 'not-yet' | 'error'; timing: InterviewTiming | null }> {
  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/${encodeURIComponent(interviewId)}/finalize`, { method: 'POST' });
    const body = (await res.json().catch(() => null)) as { timing?: unknown } | null;
    const timing = parseTiming(body?.timing);
    if (res.ok) return { result: 'finalized', timing };
    if (res.status === 409) return { result: 'not-yet', timing };
    return { result: 'error', timing };
  } catch {
    return { result: 'error', timing: null };
  }
}
