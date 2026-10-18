/**
 * Which workspace the interview session shows for a question.
 *
 * The workspace is derived from the current question only — never from a
 * previous question's mode or anything stored in the browser — so it follows
 * the question on first load, next/previous, jumps, refresh and resume.
 */

export type WorkspaceMode = 'text' | 'code';

export interface WorkspaceQuestion {
  type?: string | null;
  codingProblemSlug?: string | null;
  /** Set by the API when a question planned as coding has no runnable problem. */
  codingUnavailable?: boolean;
}

export interface Workspace {
  mode: WorkspaceMode;
  /** Label for the format badge. */
  format: 'Coding' | 'System Design' | 'Theory / Conceptual';
  /** True when the question was meant to be coded but cannot be run, so it is answered in text. */
  codingUnavailable: boolean;
}

export function workspaceFor(question: WorkspaceQuestion | null | undefined): Workspace {
  const type = question?.type ?? 'THEORY';
  // Only a coding question backed by a runnable problem opens the Coding IDE.
  if (type === 'CODING' && question?.codingProblemSlug) {
    return { mode: 'code', format: 'Coding', codingUnavailable: false };
  }
  const codingUnavailable = type === 'CODING' || Boolean(question?.codingUnavailable);
  return {
    mode: 'text',
    format: type === 'SYSTEM_DESIGN' ? 'System Design' : 'Theory / Conceptual',
    codingUnavailable,
  };
}

export const CODING_UNAVAILABLE_NOTE =
  'This is a coding question, but code can’t be run for it here, so answer in text: describe your approach, its time and space complexity, and the key code.';
