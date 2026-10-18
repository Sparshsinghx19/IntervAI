import { db } from '../../prisma/db.js';

export const IN_PROGRESS_DEFAULT_LIMIT = 5;
export const IN_PROGRESS_MAX_LIMIT = 10;
/** Upper bound on unfinished interviews scanned per request (ordered by creation, newest first). */
const IN_PROGRESS_SCAN_LIMIT = 50;

/** Interview statuses that can still be continued. COMPLETED (including a failed report) cannot. */
export const RESUMABLE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS'] as const;

/** An unfinished interview the candidate can continue, as shown on the dashboard. */
export interface InProgressInterview {
  interviewId: string;
  type: string;
  difficulty: string;
  focusArea: string;
  status: string;
  questionCount: number;
  answeredCount: number;
  startedAt: string;
  lastActivityAt: string;
}

/** Everything the session page needs to restore saved work for one interview. */
export interface InterviewProgress {
  interviewId: string;
  status: string;
  answers: Array<{ questionId: string; answerText: string; submittedAt: string }>;
  /** Latest code submission per coding question. */
  codeSubmissions: Array<{
    questionId: string;
    language: string;
    sourceCode: string;
    status: string;
    testsPassed: number;
    totalTests: number;
    submittedAt: string;
  }>;
}

interface QuestionActivity {
  type: string | null;
  answer: { submittedAt: unknown } | null;
  submissions: Array<{ createdAt: unknown }>;
}

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  return value == null ? '' : String(value);
};

const toMs = (value: unknown): number => {
  if (value == null) return 0;
  const ms = Date.parse(toIso(value));
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Same rule the API uses to decide completion: a coding question counts once it
 * has a code submission, any other question once it has a saved answer.
 */
export function countAnsweredQuestions(questions: QuestionActivity[]): number {
  return questions.filter((q) =>
    q.type === 'CODING' ? q.submissions.length > 0 : q.answer !== null && q.answer !== undefined
  ).length;
}

/** Most recent saved activity: the interview row itself, any answer, or any code submission. */
export function lastActivityMs(interview: { createdAt: unknown; updatedAt: unknown }, questions: QuestionActivity[]): number {
  let latest = Math.max(toMs(interview.createdAt), toMs(interview.updatedAt));
  for (const q of questions) {
    if (q.answer) latest = Math.max(latest, toMs(q.answer.submittedAt));
    for (const s of q.submissions) latest = Math.max(latest, toMs(s.createdAt));
  }
  return latest;
}

export const interviewProgressService = {
  /**
   * The owner's unfinished interviews, most recent activity first. Only
   * NOT_STARTED / IN_PROGRESS interviews with questions qualify; ownerless
   * legacy interviews never match. No answer text or code is returned.
   */
  listInProgress: async (ownerId: string, limit: number = IN_PROGRESS_DEFAULT_LIMIT): Promise<InProgressInterview[]> => {
    const rows = await db.orm.public.Interview
      .where((i) => i.ownerId.eq(ownerId))
      .where((i) => i.status.in([...RESUMABLE_STATUSES]))
      .select('id', 'type', 'difficulty', 'focusArea', 'questionCount', 'status', 'createdAt', 'updatedAt')
      .include('questions', (q) =>
        q
          .select('id', 'type')
          .include('answer', (a) => a.select('submittedAt'))
          .include('submissions', (s) => s.select('createdAt'))
      )
      .orderBy([(i) => i.createdAt.desc(), (i) => i.id.desc()])
      .limit(IN_PROGRESS_SCAN_LIMIT)
      .all();

    return rows
      .map((row: any) => {
        const questions: QuestionActivity[] = (row.questions ?? []).map((q: any) => ({
          type: q.type ?? null,
          answer: q.answer ?? null,
          submissions: q.submissions ?? [],
        }));
        return { row, questions, activity: lastActivityMs(row, questions) };
      })
      // An interview without questions cannot be continued.
      .filter(({ questions }) => questions.length > 0)
      .sort((a, b) => b.activity - a.activity || String(b.row.id).localeCompare(String(a.row.id)))
      .slice(0, limit)
      .map(({ row, questions, activity }) => ({
        interviewId: row.id,
        type: row.type,
        difficulty: row.difficulty,
        focusArea: row.focusArea,
        status: row.status,
        questionCount: questions.length,
        answeredCount: countAnsweredQuestions(questions),
        startedAt: toIso(row.createdAt),
        lastActivityAt: new Date(activity).toISOString(),
      }));
  },

  /** Saved answers and latest code per question for one interview (ownership is checked by the route). */
  getProgress: async (interviewId: string): Promise<InterviewProgress | null> => {
    const interview = await db.orm.public.Interview.first({ id: interviewId });
    if (!interview) return null;

    const questions = await db.orm.public.Question.where({ interviewId }).select('id').all();
    const questionIds = questions.map((q: any) => q.id);

    const [answers, submissions] = await Promise.all([
      questionIds.length
        ? db.orm.public.Answer.where((a) => a.questionId.in(questionIds)).all()
        : Promise.resolve([]),
      db.orm.public.CodeSubmission.where({ interviewId })
        .orderBy([(s) => s.createdAt.desc(), (s) => s.id.desc()])
        .all(),
    ]);

    const latestByQuestion = new Map<string, any>();
    for (const s of submissions as any[]) {
      if (!latestByQuestion.has(s.questionId)) latestByQuestion.set(s.questionId, s);
    }

    return {
      interviewId,
      status: (interview as any).status,
      answers: (answers as any[]).map((a) => ({
        questionId: a.questionId,
        answerText: a.answerText,
        submittedAt: toIso(a.submittedAt),
      })),
      codeSubmissions: [...latestByQuestion.values()].map((s) => ({
        questionId: s.questionId,
        language: s.language,
        sourceCode: s.sourceCode,
        status: s.status,
        testsPassed: s.testsPassed,
        totalTests: s.totalTests,
        submittedAt: toIso(s.createdAt),
      })),
    };
  },
};
