import { API_URL, apiFetch } from './api-client';

/**
 * Interview resume support.
 *
 * Server-side (authoritative): submitted answers and code submissions, read
 * from GET /api/interviews/:id/progress.
 * Browser-side (best effort): the current question, unsent answer text and
 * editor drafts, in localStorage under a key scoped to user + interview. A
 * local draft is only used when it is newer than what the server already has,
 * so an old draft can never replace a newer submitted answer.
 */

// ---------- Server progress ----------

export interface SavedAnswer {
  questionId: string;
  answerText: string;
  submittedAt: string;
}

export interface SavedCodeSubmission {
  questionId: string;
  language: string;
  sourceCode: string;
  status: string;
  testsPassed: number;
  totalTests: number;
  submittedAt: string;
}

export interface InterviewProgress {
  interviewId: string;
  status: string;
  /** Raw server timing (parsed by lib/interview-timer). */
  timing?: unknown;
  answers: SavedAnswer[];
  codeSubmissions: SavedCodeSubmission[];
}

type FetchFn = typeof fetch;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const hasQuestionId = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && typeof (v as Record<string, unknown>).questionId === 'string';
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function parseProgress(raw: unknown): InterviewProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.interviewId !== 'string' || !Array.isArray(r.answers) || !Array.isArray(r.codeSubmissions)) return null;
  return {
    interviewId: r.interviewId,
    status: str(r.status),
    timing: r.timing ?? null,
    answers: r.answers
      .filter(hasQuestionId)
      .map((a) => ({ questionId: str(a.questionId), answerText: str(a.answerText), submittedAt: str(a.submittedAt) })),
    codeSubmissions: r.codeSubmissions
      .filter(hasQuestionId)
      .map((s) => ({
        questionId: str(s.questionId),
        language: str(s.language),
        sourceCode: str(s.sourceCode),
        status: str(s.status),
        testsPassed: num(s.testsPassed),
        totalTests: num(s.totalTests),
        submittedAt: str(s.submittedAt),
      })),
  };
}

/** Loads saved progress. Returns null on any failure so the caller can show a recoverable error. */
export async function fetchInterviewProgress(
  interviewId: string,
  { fetchFn = apiFetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<{ ok: true; progress: InterviewProgress } | { ok: false; status: number }> {
  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/${encodeURIComponent(interviewId)}/progress`, { cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status };
    const progress = parseProgress(await res.json().catch(() => null));
    return progress ? { ok: true, progress } : { ok: false, status: 0 };
  } catch {
    return { ok: false, status: 0 };
  }
}

// ---------- Local snapshot ----------

export interface TextDraft {
  text: string;
  updatedAt: number;
}

export interface ResumeSnapshot {
  currentQuestionId: string | null;
  /** Unsent answer text, per question. */
  answerDrafts: Record<string, TextDraft>;
  /** Editor drafts, keyed `${questionId}:${language}`. */
  codeDrafts: Record<string, TextDraft>;
  /** Last language chosen in the editor, per question. */
  languages: Record<string, string>;
}

export const emptySnapshot = (): ResumeSnapshot => ({
  currentQuestionId: null,
  answerDrafts: {},
  codeDrafts: {},
  languages: {},
});

export const resumeStorageKey = (userId: string, interviewId: string) => `intervai:resume:v1:${userId}:${interviewId}`;
export const codeDraftKey = (questionId: string, language: string) => `${questionId}:${language}`;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const isDraftMap = (v: unknown): v is Record<string, TextDraft> =>
  !!v &&
  typeof v === 'object' &&
  Object.values(v as Record<string, unknown>).every(
    (d) => !!d && typeof (d as TextDraft).text === 'string' && typeof (d as TextDraft).updatedAt === 'number'
  );

export function readSnapshot(storage: StorageLike | null, key: string): ResumeSnapshot {
  if (!storage) return emptySnapshot();
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    if (!parsed || typeof parsed !== 'object') return emptySnapshot();
    return {
      currentQuestionId: typeof parsed.currentQuestionId === 'string' ? parsed.currentQuestionId : null,
      answerDrafts: isDraftMap(parsed.answerDrafts) ? parsed.answerDrafts : {},
      codeDrafts: isDraftMap(parsed.codeDrafts) ? parsed.codeDrafts : {},
      languages:
        parsed.languages && typeof parsed.languages === 'object'
          ? Object.fromEntries(Object.entries(parsed.languages).filter(([, v]) => typeof v === 'string')) as Record<string, string>
          : {},
    };
  } catch {
    return emptySnapshot();
  }
}

export function writeSnapshot(storage: StorageLike | null, key: string, snapshot: ResumeSnapshot): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Storage full or disabled: drafts stay in memory for this page only.
  }
}

export function clearSnapshot(storage: StorageLike | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export const browserStorage = (): StorageLike | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

/**
 * Keeps one interview's snapshot in memory and writes it to storage after a
 * short pause (and immediately on `flush`, e.g. when the page is hidden).
 */
export function createSnapshotStore(storage: StorageLike | null, key: string, delayMs = 400) {
  let snapshot = readSnapshot(storage, key);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    writeSnapshot(storage, key, snapshot);
  };

  return {
    get: () => snapshot,
    update(change: (current: ResumeSnapshot) => ResumeSnapshot) {
      snapshot = change(snapshot);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    clear() {
      if (timer) clearTimeout(timer);
      timer = null;
      snapshot = emptySnapshot();
      clearSnapshot(storage, key);
    },
  };
}

export type SnapshotStore = ReturnType<typeof createSnapshotStore>;

// ---------- Restore decisions (pure) ----------

interface QuestionRef {
  id: string | number;
  type?: string;
}

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Answers already on the server, per question, in the shape the session page
 * keeps: text answers, and the latest submitted code for coding questions.
 */
export function savedAnswersFromProgress(progress: InterviewProgress): Record<string, string> {
  const saved: Record<string, string> = {};
  for (const a of progress.answers) saved[a.questionId] = a.answerText;
  for (const s of progress.codeSubmissions) saved[s.questionId] = s.sourceCode;
  return saved;
}

/** Same rule as the API's completion check: coding needs a code submission, everything else an answer. */
export function isQuestionAnswered(question: QuestionRef, progress: InterviewProgress): boolean {
  const id = String(question.id);
  return question.type === 'CODING'
    ? progress.codeSubmissions.some((s) => s.questionId === id)
    : progress.answers.some((a) => a.questionId === id);
}

export function countAnswered(questions: QuestionRef[], progress: InterviewProgress): number {
  return questions.filter((q) => isQuestionAnswered(q, progress)).length;
}

/**
 * Where to reopen the interview: the last question the candidate was on (if it
 * still exists), otherwise the first unanswered one, otherwise the first.
 */
export function chooseResumeIndex(questions: QuestionRef[], progress: InterviewProgress, snapshot: ResumeSnapshot): number {
  if (snapshot.currentQuestionId) {
    const index = questions.findIndex((q) => String(q.id) === snapshot.currentQuestionId);
    if (index !== -1) return index;
  }
  const firstOpen = questions.findIndex((q) => !isQuestionAnswered(q, progress));
  return firstOpen === -1 ? 0 : firstOpen;
}

/** Text to show for a question: an unsent draft only if it is newer than the submitted answer. */
export function answerTextFor(questionId: string, progress: InterviewProgress | null, snapshot: ResumeSnapshot, saved: Record<string, string>): string {
  const draft = snapshot.answerDrafts[questionId];
  const submitted = progress?.answers.find((a) => a.questionId === questionId);
  if (draft && (!submitted || draft.updatedAt > time(submitted.submittedAt))) return draft.text;
  return saved[questionId] ?? '';
}

/** Editor contents for a question/language: a newer local draft wins, then the last submission in that language. */
export function codeFor(
  questionId: string,
  language: string,
  submission: { language: string; sourceCode: string; submittedAt: string } | undefined,
  snapshot: ResumeSnapshot
): string | undefined {
  const draft = snapshot.codeDrafts[codeDraftKey(questionId, language)];
  const matchingSubmission = submission && submission.language === language ? submission : undefined;
  if (draft && (!matchingSubmission || draft.updatedAt > time(matchingSubmission.submittedAt))) return draft.text;
  return matchingSubmission?.sourceCode;
}

/** Language to open the editor in: the last one used for this question, else the submitted one. */
export function languageFor(questionId: string, submission: { language: string } | undefined, snapshot: ResumeSnapshot): string | undefined {
  return snapshot.languages[questionId] ?? submission?.language;
}
