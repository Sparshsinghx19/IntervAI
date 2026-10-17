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

export const interviewHistoryService = {
  /**
   * Newest completed reports first, for interviews owned by `ownerId` only.
   * Reads saved rows; never triggers evaluation. Ownerless legacy interviews
   * never match because NULL is not equal to any user id.
   */
  listCompletedReports: async (ownerId: string, limit: number = HISTORY_DEFAULT_LIMIT): Promise<InterviewHistoryItem[]> => {
    const rows = await db.orm.public.EvaluationReport
      .where((r) => r.status.eq('COMPLETED'))
      .where((r) => r.interview.some((i) => i.ownerId.eq(ownerId)))
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
};
