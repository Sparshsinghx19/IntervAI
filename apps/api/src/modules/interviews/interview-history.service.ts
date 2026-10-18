import { db } from '../../prisma/db.js';

export const HISTORY_DEFAULT_LIMIT = 10;
export const HISTORY_MAX_LIMIT = 20;
const SUMMARY_MAX_LENGTH = 280;

/** One completed interview with a saved report, as shown in "My Reports". */
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

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  return value == null ? '' : String(value);
};

const shorten = (text: unknown): string | null => {
  if (typeof text !== 'string' || text.trim() === '') return null;
  return text.length > SUMMARY_MAX_LENGTH ? `${text.slice(0, SUMMARY_MAX_LENGTH - 1).trimEnd()}…` : text;
};

/** Headline numbers for the dashboard, computed over all of a user's completed reports. */
export interface DashboardSummary {
  /** Completed interviews that have a saved, COMPLETED evaluation report. */
  completedInterviews: number;
  /** How many of those reports carry an overall score (the basis for average and best). */
  scoredReports: number;
  /** Mean overall score on the report's 0–100 scale, one decimal; null when nothing is scored. */
  averageScore: number | null;
  bestScore: number | null;
  bestReport: { interviewId: string; type: string; focusArea: string; completedAt: string } | null;
  lastCompletedAt: string | null;
}

/**
 * Every query here starts from this scope: COMPLETED reports whose interview is
 * owned by `ownerId`. Ownerless legacy interviews never match (NULL != id).
 */
const ownedCompletedReports = (ownerId: string) =>
  db.orm.public.EvaluationReport
    .where((r) => r.status.eq('COMPLETED'))
    .where((r) => r.interview.some((i) => i.ownerId.eq(ownerId)));

const toNumberOrNull = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export const interviewHistoryService = {
  /**
   * Newest completed reports first, for interviews owned by `ownerId` only.
   * Reads saved rows; never triggers evaluation. Ownerless legacy interviews
   * never match because NULL is not equal to any user id.
   */
  listCompletedReports: async (ownerId: string, limit: number = HISTORY_DEFAULT_LIMIT): Promise<InterviewHistoryItem[]> => {
    const rows = await ownedCompletedReports(ownerId)
      .select('id', 'interviewId', 'overallScore', 'performanceLevel', 'summary', 'questionsEvaluated', 'updatedAt')
      .include('interview', (i) => i.select('id', 'type', 'difficulty', 'focusArea', 'questionCount', 'createdAt'))
      .orderBy([(r) => r.updatedAt.desc(), (r) => r.id.desc()])
      .limit(limit)
      .all();

    return rows
      .filter((row: any) => row.interview)
      .map((row: any) => ({
        interviewId: row.interviewId,
        reportId: row.id,
        type: row.interview.type,
        difficulty: row.interview.difficulty,
        focusArea: row.interview.focusArea,
        questionCount: row.interview.questionCount,
        questionsEvaluated: row.questionsEvaluated ?? null,
        overallScore: row.overallScore ?? null,
        performanceLevel: row.performanceLevel ?? null,
        summary: shorten(row.summary),
        startedAt: toIso(row.interview.createdAt),
        // The report row is last written when it moves to COMPLETED.
        completedAt: toIso(row.updatedAt),
      }));
  },

  /**
   * Aggregates in the database over the user's full set of completed reports
   * (not just the page the history list shows). Reports without a stored
   * score count as completed but are left out of the average and best score.
   */
  getDashboardSummary: async (ownerId: string): Promise<DashboardSummary> => {
    const [totals, scored, best] = await Promise.all([
      ownedCompletedReports(ownerId).aggregate((a) => ({ count: a.count(), lastCompletedAt: a.max('updatedAt') })),
      ownedCompletedReports(ownerId)
        .where((r) => r.overallScore.isNotNull())
        .aggregate((a) => ({ count: a.count(), average: a.avg('overallScore'), best: a.max('overallScore') })),
      ownedCompletedReports(ownerId)
        .where((r) => r.overallScore.isNotNull())
        .select('interviewId', 'overallScore', 'updatedAt')
        .include('interview', (i) => i.select('id', 'type', 'focusArea'))
        // Ties go to the most recent report.
        .orderBy([(r) => r.overallScore.desc(), (r) => r.updatedAt.desc(), (r) => r.id.desc()])
        .limit(1)
        .first(),
    ]);

    const scoredCount = Number(scored.count) || 0;
    const average = toNumberOrNull(scored.average);
    const bestRow: any = best;

    return {
      completedInterviews: Number(totals.count) || 0,
      scoredReports: scoredCount,
      averageScore: scoredCount > 0 && average !== null ? Math.round(average * 10) / 10 : null,
      bestScore: scoredCount > 0 ? toNumberOrNull(scored.best) : null,
      bestReport:
        bestRow && bestRow.interview
          ? {
              interviewId: bestRow.interviewId,
              type: bestRow.interview.type,
              focusArea: bestRow.interview.focusArea,
              completedAt: toIso(bestRow.updatedAt),
            }
          : null,
      lastCompletedAt: totals.lastCompletedAt == null ? null : toIso(totals.lastCompletedAt),
    };
  },
};
