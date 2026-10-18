import { API_URL, apiFetch } from './api-client';
import { fetchInterviewHistory, InterviewHistoryItem } from './history-api';

/** GET /api/interviews/summary: computed server-side over all of the user's completed reports. */
export interface DashboardSummary {
  completedInterviews: number;
  scoredReports: number;
  averageScore: number | null;
  bestScore: number | null;
  bestReport: { interviewId: string; type: string; focusArea: string; completedAt: string } | null;
  lastCompletedAt: string | null;
}

export type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: DashboardSummary; recent: InterviewHistoryItem[] };

export const DASHBOARD_RECENT_LIMIT = 5;

type FetchFn = typeof fetch;

const LOAD_ERROR = 'We couldn’t load your dashboard. Check your connection and try again.';

const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
const score = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function parseSummary(raw: unknown): DashboardSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const completed = count(r.completedInterviews);
  const scored = count(r.scoredReports);
  if (completed === null || scored === null) return null;

  const best = r.bestReport as Record<string, unknown> | null | undefined;
  return {
    completedInterviews: completed,
    scoredReports: scored,
    averageScore: score(r.averageScore),
    bestScore: score(r.bestScore),
    bestReport:
      best && typeof best.interviewId === 'string'
        ? {
            interviewId: best.interviewId,
            type: typeof best.type === 'string' ? best.type : '',
            focusArea: typeof best.focusArea === 'string' ? best.focusArea : '',
            completedAt: typeof best.completedAt === 'string' ? best.completedAt : '',
          }
        : null,
    lastCompletedAt: typeof r.lastCompletedAt === 'string' && r.lastCompletedAt ? r.lastCompletedAt : null,
  };
}

export async function fetchDashboardSummary(
  { fetchFn = apiFetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<DashboardSummary | null> {
  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/summary`, { cache: 'no-store' });
    if (!res.ok) return null;
    return parseSummary(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

/**
 * Loads the metrics and the most recent reports together, so the page renders
 * once with consistent data instead of filling in piece by piece.
 */
export async function loadDashboard(
  { fetchFn = apiFetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<Exclude<DashboardState, { status: 'loading' }>> {
  const [summary, history] = await Promise.all([
    fetchDashboardSummary({ fetchFn, apiUrl }),
    fetchInterviewHistory({ fetchFn, apiUrl, limit: DASHBOARD_RECENT_LIMIT }),
  ]);
  if (!summary || history.status !== 'ready') return { status: 'error', message: LOAD_ERROR };
  return { status: 'ready', summary, recent: history.reports };
}

/** Scores use the report's 0–100 scale: whole numbers as-is, averages to one decimal. */
export function formatScore(value: number | null): string {
  if (value === null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** "Priya Sharma" → "Priya"; empty names give no name rather than a placeholder. */
export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}
