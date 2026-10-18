import { API_URL, apiFetch } from './api-client';

/** Interview setup for topic, resume-based and mixed interviews. */

export type InterviewMode = 'TOPIC' | 'RESUME' | 'MIXED';
export type SetupQuestionType = 'THEORY' | 'CODING' | 'SYSTEM_DESIGN';

export interface ResumeProject {
  name: string;
  summary: string;
  technologies: string[];
  highlights: string[];
}

export interface ResumeRole {
  title: string;
  summary: string;
  technologies: string[];
}

/** What the server extracted from the resume (this, not the file, is kept with the interview). */
export interface ResumeProfile {
  headline: string | null;
  skills: string[];
  projects: ResumeProject[];
  experience: ResumeRole[];
}

export const RESUME_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const RESUME_MIN_TEXT_CHARS = 80;
const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface SetupState {
  mode: InterviewMode;
  interviewType: string;
  difficulty: string;
  focusArea: string;
  targetRole: string;
  durationMinutes: number;
  questionTypes: SetupQuestionType[];
  resumeProfile: ResumeProfile | null;
}

/** Mixed is recommended once there is both a resume and a subject to combine. */
export const recommendedMode = (hasResume: boolean, hasSubject: boolean): InterviewMode =>
  hasResume && hasSubject ? 'MIXED' : hasResume ? 'RESUME' : 'TOPIC';

/** The first problem with the setup, in on-screen order, or null when it can be submitted. */
export function validateSetup(s: SetupState): string | null {
  if (s.mode === 'TOPIC') {
    if (!s.interviewType) return 'Choose an interview type.';
    if (!s.difficulty) return 'Choose a difficulty.';
    if (!s.focusArea) return 'Choose a focus area.';
    return null;
  }
  const role = s.targetRole.trim();
  if (role.length < 2 || role.length > 100) return 'Enter the role you are interviewing for.';
  if (!s.resumeProfile) return 'Add your resume so we can ask about your own projects and skills.';
  if (s.mode === 'MIXED' && !s.focusArea) return 'Choose a subject to combine with your resume.';
  if (!s.difficulty) return 'Choose a difficulty.';
  if (s.questionTypes.length === 0) return 'Choose at least one question type.';
  if (!s.questionTypes.includes('THEORY') && !s.questionTypes.includes('SYSTEM_DESIGN')) {
    return 'Resume questions need Theory or System Design questions enabled.';
  }
  return null;
}

/** Body for POST /api/interviews. Only fields relevant to the mode are sent. */
export function buildCreatePayload(s: SetupState, clientRequestId?: string): Record<string, unknown> {
  // The same id is sent on a retry, so the server returns the interview it already made.
  const retryKey = clientRequestId ? { clientRequestId } : {};
  if (s.mode === 'TOPIC') {
    return {
      ...retryKey,
      mode: 'TOPIC',
      type: s.interviewType,
      difficulty: s.difficulty,
      focusArea: s.focusArea,
      durationMinutes: s.durationMinutes,
      ...(s.targetRole.trim() ? { targetRole: s.targetRole.trim() } : {}),
    };
  }
  return {
    ...retryKey,
    mode: s.mode,
    type: s.interviewType || 'technical',
    difficulty: s.difficulty,
    targetRole: s.targetRole.trim(),
    durationMinutes: s.durationMinutes,
    questionTypes: s.questionTypes,
    resumeProfile: s.resumeProfile,
    ...(s.mode === 'MIXED' ? { focusArea: s.focusArea } : {}),
  };
}

/** Client-side check before uploading (the server validates the actual bytes again). */
export function checkResumeFile(file: { name: string; size: number; type: string }): { ok: true; mime: string } | { ok: false; error: string } {
  const name = file.name.toLowerCase();
  const mime = name.endsWith('.pdf') ? PDF_MIME : name.endsWith('.docx') ? DOCX_MIME : '';
  if (!mime) return { ok: false, error: 'Upload a PDF or Word (.docx) file, or paste your resume as text.' };
  if (file.size === 0) return { ok: false, error: 'That file is empty.' };
  if (file.size > RESUME_MAX_FILE_BYTES) return { ok: false, error: 'Resume files must be 2 MB or smaller.' };
  return { ok: true, mime };
}

type FetchFn = typeof fetch;
export type ParseResult = { ok: true; profile: ResumeProfile } | { ok: false; error: string };

async function readParse(res: Response): Promise<ParseResult> {
  const body = (await res.json().catch(() => null)) as { profile?: ResumeProfile; error?: string } | null;
  if (res.ok && body?.profile) return { ok: true, profile: body.profile };
  if (res.status === 429) return { ok: false, error: 'You have analysed several resumes recently. Please wait a few minutes.' };
  if (res.status >= 500 && res.status !== 503) return { ok: false, error: 'Something went wrong while reading your resume. Please try again.' };
  return { ok: false, error: typeof body?.error === 'string' ? body.error : 'We couldn’t read that resume.' };
}

/** Sends a resume file for analysis. The server does not store the file. */
export async function parseResumeFile(
  file: Blob & { name: string },
  { fetchFn = apiFetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<ParseResult> {
  const check = checkResumeFile({ name: file.name, size: file.size, type: file.type });
  if (!check.ok) return check;
  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/resume/parse`, {
      method: 'POST',
      headers: { 'Content-Type': check.mime },
      body: file,
    });
    return await readParse(res);
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

/** Sends pasted resume text for analysis. */
export async function parseResumeText(
  text: string,
  { fetchFn = apiFetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<ParseResult> {
  if (text.trim().length < RESUME_MIN_TEXT_CHARS) {
    return { ok: false, error: 'Paste your full resume (it looks too short to plan questions from).' };
  }
  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/resume/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return await readParse(res);
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

/** Short label for where a question came from, shown in the session and report. */
export function questionOriginLabel(
  origin: string | null | undefined,
  category: string | null | undefined,
  hasSources = false
): string | null {
  if (category === 'INTRODUCTION') return 'Introduction';
  if (origin === 'SUBJECT') return hasSources ? 'Researched for this topic' : 'Written for this topic';
  if (origin === 'RESUME') return category === 'SCENARIO' ? 'Scenario · based on your resume' : 'Based on your resume';
  if (origin === 'FOLLOW_UP') return 'Follow-up';
  if (category === 'FUNDAMENTALS') return 'Fundamentals';
  if (origin === 'CURATED' && category) return 'From the question bank';
  return null;
}

/** How the session/report describes where this interview's questions came from. */
export function researchNote(research: { status: string; sourceCount: number } | null | undefined): string | null {
  if (!research) return null;
  if (research.status === 'grounded') {
    return `Some questions were informed by web research (${research.sourceCount} source${research.sourceCount === 1 ? '' : 's'}).`;
  }
  return 'Web research wasn’t available when this interview was prepared, so questions come from the curated question bank and your setup.';
}
