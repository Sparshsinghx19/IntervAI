import { API_URL, apiFetch } from './api-client';
import { difficulties, focusAreas, interviewTypes } from '@/data/interview-options';
import type { EvaluationReportResponse } from '@/types/evaluation';
import { fetchEvaluationReport } from './evaluation-api';

/** One completed interview with a saved report (GET /api/interviews/history). */
export interface InterviewHistoryItem {
  interviewId: string;
  reportId: string;
  type: string;
  difficulty: string;
  focusArea: string;
  questionCount: number;
  questionsEvaluated: number | null;
  overallScore: number | null;
  performanceLevel: string | null;
  summary: string | null;
  startedAt: string;
  completedAt: string;
}

export type HistoryState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; reports: InterviewHistoryItem[] };

type FetchFn = typeof fetch;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function parseItem(raw: unknown): InterviewHistoryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.interviewId !== 'string' || !r.interviewId) return null;
  return {
    interviewId: r.interviewId,
    reportId: str(r.reportId),
    type: str(r.type),
    difficulty: str(r.difficulty),
    focusArea: str(r.focusArea),
    questionCount: numOrNull(r.questionCount) ?? 0,
    questionsEvaluated: numOrNull(r.questionsEvaluated),
    overallScore: numOrNull(r.overallScore),
    performanceLevel: typeof r.performanceLevel === 'string' ? r.performanceLevel : null,
    summary: typeof r.summary === 'string' ? r.summary : null,
    startedAt: str(r.startedAt),
    completedAt: str(r.completedAt),
  };
}

/** Loads the signed-in user's recent completed reports. Never throws. */
export async function fetchInterviewHistory(
  { fetchFn = apiFetch, apiUrl = API_URL, limit }: { fetchFn?: FetchFn; apiUrl?: string; limit?: number } = {}
): Promise<Exclude<HistoryState, { status: 'loading' }>> {
  const query = limit ? `?limit=${encodeURIComponent(String(limit))}` : '';
  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/history${query}`, { cache: 'no-store' });
    if (res.status === 401) {
      return { status: 'error', message: 'Your session has expired. Please log in again.' };
    }
    if (!res.ok) {
      return { status: 'error', message: 'We could not load your reports right now. Please try again.' };
    }
    const body = (await res.json().catch(() => null)) as { reports?: unknown } | null;
    if (!body || !Array.isArray(body.reports)) {
      return { status: 'error', message: 'We could not load your reports right now. Please try again.' };
    }
    const reports = body.reports.map(parseItem).filter((r): r is InterviewHistoryItem => r !== null);
    return { status: 'ready', reports };
  } catch {
    return { status: 'error', message: 'Could not reach the server. Check your connection and try again.' };
  }
}

// ---------- Report detail ----------

export type ReportDetailState =
  | { status: 'loading' }
  | { status: 'ready'; report: EvaluationReportResponse }
  | { status: 'unavailable'; reason: 'missing' | 'pending' | 'failed' }
  | { status: 'error'; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads the saved report for one interview (GET only). It never asks the API
 * to generate a report, so opening history costs no AI calls.
 */
export async function loadSavedReport(
  interviewId: string,
  { fetchFn = apiFetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<Exclude<ReportDetailState, { status: 'loading' }>> {
  if (!UUID_PATTERN.test(interviewId)) return { status: 'unavailable', reason: 'missing' };

  const result = await fetchEvaluationReport({ interviewId, apiUrl, fetchFn });
  if (result.found && result.report) {
    if (result.report.status === 'COMPLETED') return { status: 'ready', report: result.report };
    return { status: 'unavailable', reason: result.report.status === 'FAILED' ? 'failed' : 'pending' };
  }
  if (result.error) {
    return { status: 'error', message: 'We could not load this report right now. Please try again.' };
  }
  // 404: no report, or the interview is not this user's (the API does not say which).
  return { status: 'unavailable', reason: 'missing' };
}

// ---------- Presentation helpers ----------

const titleCase = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const labelFrom = (options: { id: string; label: string }[], value: string) =>
  options.find((o) => o.id.toLowerCase() === value.trim().toLowerCase())?.label ?? (value ? titleCase(value) : '');

export const formatFocusArea = (value: string) => labelFrom(focusAreas, value) || 'General';
export const formatInterviewType = (value: string) => labelFrom(interviewTypes, value) || 'Interview';
export const formatDifficulty = (value: string) => labelFrom(difficulties, value);

export function formatCompletedDate(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

export type ScoreTone = 'excellent' | 'strong' | 'steady' | 'developing' | 'none';

/** Same bands as the full report view. */
export function scoreTone(score: number | null): ScoreTone {
  if (score === null) return 'none';
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'strong';
  if (score >= 55) return 'steady';
  return 'developing';
}
