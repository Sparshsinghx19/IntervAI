import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { workspaceFor } from './workspace-mode';
import {
  answerTextFor,
  chooseResumeIndex,
  codeFor,
  emptySnapshot,
  InterviewProgress,
  languageFor,
  savedAnswersFromProgress,
} from './interview-resume';

const theory = { id: 'q1', type: 'THEORY' as const, codingProblemSlug: null };
const coding = { id: 'q2', type: 'CODING' as const, codingProblemSlug: 'reverse-linked-list' };
const design = { id: 'q3', type: 'SYSTEM_DESIGN' as const, codingProblemSlug: null };
// Stored as coding with no runnable problem: the API returns it as text with a flag.
const unrunnable = { id: 'q4', type: 'THEORY' as const, codingProblemSlug: null, codingUnavailable: true };
const QUESTIONS = [theory, coding, design, unrunnable];

const progress = (over: Partial<InterviewProgress> = {}): InterviewProgress => ({
  interviewId: 'iv', status: 'IN_PROGRESS', answers: [], codeSubmissions: [], ...over,
});

describe('Workspace follows the question type', () => {
  it('opens Text Mode for theory and system design, the Coding IDE for coding', () => {
    assert.deepEqual(workspaceFor(theory), { mode: 'text', format: 'Theory / Conceptual', codingUnavailable: false });
    assert.deepEqual(workspaceFor(design), { mode: 'text', format: 'System Design', codingUnavailable: false });
    assert.deepEqual(workspaceFor(coding), { mode: 'code', format: 'Coding', codingUnavailable: false });
  });

  it('never opens the Coding IDE for a coding question without a runnable problem', () => {
    assert.equal(workspaceFor(unrunnable).mode, 'text');
    assert.equal(workspaceFor(unrunnable).codingUnavailable, true);
    // Even an inconsistent payload (CODING with no slug) is shown as text with the notice.
    assert.deepEqual(workspaceFor({ type: 'CODING', codingProblemSlug: null }), { mode: 'text', format: 'Theory / Conceptual', codingUnavailable: true });
  });

  it('switches on every move between questions of different types, with no carried-over mode', () => {
    const forward = QUESTIONS.map((q) => workspaceFor(q).mode);
    assert.deepEqual(forward, ['text', 'code', 'text', 'text']);
    const backward = [...QUESTIONS].reverse().map((q) => workspaceFor(q).mode);
    assert.deepEqual(backward, ['text', 'text', 'code', 'text']);
    // A jump straight from the last question to the coding question.
    assert.equal(workspaceFor(QUESTIONS[1]).mode, 'code');
  });

  it('defaults to Text Mode before questions load and for legacy questions without a type', () => {
    assert.equal(workspaceFor(undefined).mode, 'text');
    assert.equal(workspaceFor({}).mode, 'text');
  });
});

describe('Refresh and resume pick the workspace of the restored question', () => {
  it('reopens on the saved question and uses its type, not a stored mode', () => {
    const snapshot = { ...emptySnapshot(), currentQuestionId: 'q2' };
    const index = chooseResumeIndex(QUESTIONS, progress(), snapshot);
    assert.equal(index, 1);
    assert.equal(workspaceFor(QUESTIONS[index]).mode, 'code');
  });

  it('resumes from the dashboard at the first unanswered question in its own mode', () => {
    const p = progress({
      answers: [{ questionId: 'q1', answerText: 'Saved theory answer', submittedAt: '2026-10-18T10:00:00.000Z' }],
    });
    const index = chooseResumeIndex(QUESTIONS, p, emptySnapshot());
    assert.equal(index, 1);
    assert.equal(workspaceFor(QUESTIONS[index]).mode, 'code');
  });

  it('counts an unrunnable coding question as answered by its text answer', () => {
    const p = progress({
      answers: [{ questionId: 'q4', answerText: 'Two pointers…', submittedAt: '2026-10-18T10:00:00.000Z' }],
    });
    assert.equal(chooseResumeIndex([unrunnable, theory], p, emptySnapshot()), 1);
  });
});

describe('Drafts and submissions survive workspace changes', () => {
  const submittedAt = '2026-10-18T10:00:00.000Z';
  const later = Date.parse(submittedAt) + 60_000;
  const p = progress({
    answers: [{ questionId: 'q1', answerText: 'Saved theory answer', submittedAt }],
    codeSubmissions: [{ questionId: 'q2', language: 'python', sourceCode: 'def f(): pass', status: 'ACCEPTED', testsPassed: 3, totalTests: 3, submittedAt }],
  });
  const snapshot = {
    ...emptySnapshot(),
    answerDrafts: { q3: { text: 'Unsent design notes', updatedAt: later } },
    codeDrafts: { 'q2:cpp': { text: 'int main() {}', updatedAt: later } },
    languages: { q2: 'cpp' },
  };
  const saved = savedAnswersFromProgress(p);

  it('keeps the saved theory answer and the unsent system-design draft after visiting the coding question', () => {
    // theory -> coding -> design -> back to theory: each lookup is per question, independent of mode.
    assert.equal(answerTextFor('q1', p, snapshot, saved), 'Saved theory answer');
    assert.equal(answerTextFor('q3', p, snapshot, saved), 'Unsent design notes');
  });

  it('keeps the coding draft, chosen language and submitted solution per language', () => {
    assert.equal(languageFor('q2', p.codeSubmissions[0], snapshot), 'cpp');
    assert.equal(codeFor('q2', 'cpp', p.codeSubmissions[0], snapshot), 'int main() {}');
    assert.equal(codeFor('q2', 'python', p.codeSubmissions[0], snapshot), 'def f(): pass');
  });
});
