import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  answerTextFor,
  chooseResumeIndex,
  codeFor,
  countAnswered,
  createSnapshotStore,
  emptySnapshot,
  fetchInterviewProgress,
  InterviewProgress,
  languageFor,
  readSnapshot,
  resumeStorageKey,
  savedAnswersFromProgress,
} from './interview-resume';
import { fetchInProgressInterviews, InProgressState, resumeHref } from './dashboard-api';
import { ContinueInterviews } from '../components/dashboard/ContinueInterviews';

const IV = '11111111-1111-4111-8111-111111111111';

/** Minimal in-memory localStorage. */
const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
};

const questions = [
  { id: 'q1', type: 'THEORY' },
  { id: 'q2', type: 'CODING' },
  { id: 'q3', type: 'THEORY' },
];

const progress = (overrides: Partial<InterviewProgress> = {}): InterviewProgress => ({
  interviewId: IV,
  status: 'IN_PROGRESS',
  answers: [{ questionId: 'q1', answerText: 'Saved answer one', submittedAt: '2026-10-10T10:00:00.000Z' }],
  codeSubmissions: [],
  ...overrides,
});

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('Resume: server progress', () => {
  beforeEach(() => mock.restoreAll());

  it('loads saved progress for the same interview with the session cookie (GET only)', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => jsonResponse(200, progress()));
    const result = await fetchInterviewProgress(IV, { apiUrl: 'http://api' });
    assert.equal(result.ok, true);
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, `http://api/api/interviews/${IV}/progress`);
    assert.equal(init.credentials, 'include');
    assert.equal(init.method, undefined, 'never POSTs: resuming creates nothing');
  });

  it('reports failures so the page can show a recoverable error', async () => {
    const notFound = await fetchInterviewProgress(IV, { fetchFn: (async () => jsonResponse(404, {})) as unknown as typeof fetch });
    assert.deepEqual(notFound, { ok: false, status: 404 });
    const junk = await fetchInterviewProgress(IV, { fetchFn: (async () => jsonResponse(200, { nope: 1 })) as unknown as typeof fetch });
    assert.equal(junk.ok, false);
    const offline = await fetchInterviewProgress(IV, { fetchFn: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch });
    assert.deepEqual(offline, { ok: false, status: 0 });
  });

  it('restores submitted answers and code into the answer cache', () => {
    const p = progress({
      codeSubmissions: [{ questionId: 'q2', language: 'python', sourceCode: 'print(1)', status: 'ACCEPTED', testsPassed: 2, totalTests: 2, submittedAt: '2026-10-10T11:00:00.000Z' }],
    });
    assert.deepEqual(savedAnswersFromProgress(p), { q1: 'Saved answer one', q2: 'print(1)' });
  });

  it('counts progress with the same rule as interview completion', () => {
    assert.equal(countAnswered(questions, progress()), 1);
    // A text answer on a coding question does not count; a code submission does.
    const p = progress({
      answers: [{ questionId: 'q2', answerText: 'code as text', submittedAt: '2026-10-10T10:00:00.000Z' }],
      codeSubmissions: [{ questionId: 'q2', language: 'cpp', sourceCode: 'x', status: 'ACCEPTED', testsPassed: 1, totalTests: 1, submittedAt: '2026-10-10T11:00:00.000Z' }],
    });
    assert.equal(countAnswered(questions, p), 1);
  });
});

describe('Resume: where to reopen', () => {
  it('reopens the last question the candidate was on', () => {
    const snap = { ...emptySnapshot(), currentQuestionId: 'q3' };
    assert.equal(chooseResumeIndex(questions, progress(), snap), 2);
  });

  it('falls back to the first unanswered question, then to the first', () => {
    assert.equal(chooseResumeIndex(questions, progress(), emptySnapshot()), 1);
    // A stale position for a question that no longer exists is ignored.
    assert.equal(chooseResumeIndex(questions, progress(), { ...emptySnapshot(), currentQuestionId: 'gone' }), 1);
    const allDone = progress({
      answers: [
        { questionId: 'q1', answerText: 'a', submittedAt: '2026-10-10T10:00:00.000Z' },
        { questionId: 'q3', answerText: 'c', submittedAt: '2026-10-10T10:00:00.000Z' },
      ],
      codeSubmissions: [{ questionId: 'q2', language: 'cpp', sourceCode: 'b', status: 'ACCEPTED', testsPassed: 1, totalTests: 1, submittedAt: '2026-10-10T10:00:00.000Z' }],
    });
    assert.equal(chooseResumeIndex(questions, allDone, emptySnapshot()), 0);
  });
});

describe('Resume: drafts never overwrite newer answers', () => {
  const saved = { q1: 'Saved answer one' };

  it('uses an unsent draft that is newer than the submitted answer', () => {
    const snap = { ...emptySnapshot(), answerDrafts: { q1: { text: 'Edited after submitting', updatedAt: Date.parse('2026-10-11T00:00:00Z') } } };
    assert.equal(answerTextFor('q1', progress(), snap, saved), 'Edited after submitting');
  });

  it('ignores a draft older than the submitted answer', () => {
    const snap = { ...emptySnapshot(), answerDrafts: { q1: { text: 'Old draft', updatedAt: Date.parse('2026-10-09T00:00:00Z') } } };
    assert.equal(answerTextFor('q1', progress(), snap, saved), 'Saved answer one');
  });

  it('restores unsent text for a question with no submitted answer', () => {
    const snap = { ...emptySnapshot(), answerDrafts: { q3: { text: 'Half-written', updatedAt: 1 } } };
    assert.equal(answerTextFor('q3', progress(), snap, saved), 'Half-written');
    assert.equal(answerTextFor('q2', progress(), emptySnapshot(), saved), '');
  });

  it('restores code per question and language, preferring the newer of draft and submission', () => {
    const submission = { language: 'python', sourceCode: 'print("submitted")', submittedAt: '2026-10-10T10:00:00.000Z' };
    const newer = { ...emptySnapshot(), codeDrafts: { 'q2:python': { text: 'print("draft")', updatedAt: Date.parse('2026-10-11T00:00:00Z') } } };
    const older = { ...emptySnapshot(), codeDrafts: { 'q2:python': { text: 'print("old")', updatedAt: Date.parse('2026-10-01T00:00:00Z') } } };
    assert.equal(codeFor('q2', 'python', submission, newer), 'print("draft")');
    assert.equal(codeFor('q2', 'python', submission, older), 'print("submitted")');
    // A submission in another language does not leak into this editor.
    assert.equal(codeFor('q2', 'cpp', submission, emptySnapshot()), undefined);
  });

  it('remembers the editor language per question, else uses the submitted language', () => {
    assert.equal(languageFor('q2', { language: 'python' }, { ...emptySnapshot(), languages: { q2: 'java' } }), 'java');
    assert.equal(languageFor('q2', { language: 'python' }, emptySnapshot()), 'python');
    assert.equal(languageFor('q2', undefined, emptySnapshot()), undefined);
  });
});

describe('Resume: local snapshot storage', () => {
  it('scopes storage by user and interview', () => {
    assert.notEqual(resumeStorageKey('user-a', IV), resumeStorageKey('user-b', IV));
    assert.notEqual(resumeStorageKey('user-a', IV), resumeStorageKey('user-a', 'other'));
  });

  it('survives a refresh: drafts and position written by one page load are read by the next', () => {
    const storage = memoryStorage();
    const key = resumeStorageKey('user-a', IV);
    const first = createSnapshotStore(storage, key, 10_000);
    first.update((s) => ({ ...s, currentQuestionId: 'q3', answerDrafts: { q3: { text: 'Unsent work', updatedAt: Date.now() } } }));
    assert.equal(storage.data.size, 0, 'writes are debounced');
    first.flush(); // what pagehide / visibilitychange does

    const afterRefresh = createSnapshotStore(storage, key);
    const snap = afterRefresh.get();
    assert.equal(chooseResumeIndex(questions, progress(), snap), 2);
    assert.equal(answerTextFor('q3', progress(), snap, savedAnswersFromProgress(progress())), 'Unsent work');

    // Another account on the same browser sees nothing.
    assert.deepEqual(createSnapshotStore(storage, resumeStorageKey('user-b', IV)).get(), emptySnapshot());
  });

  it('clears everything once the interview is finished', () => {
    const storage = memoryStorage();
    const key = resumeStorageKey('user-a', IV);
    const store = createSnapshotStore(storage, key);
    store.update((s) => ({ ...s, currentQuestionId: 'q1' }));
    store.flush();
    store.clear();
    assert.equal(storage.getItem(key), null);
    assert.deepEqual(store.get(), emptySnapshot());
  });

  it('tolerates missing, corrupt or unavailable storage', () => {
    const storage = memoryStorage();
    storage.setItem('k', '{not json');
    assert.deepEqual(readSnapshot(storage, 'k'), emptySnapshot());
    storage.setItem('k', JSON.stringify({ currentQuestionId: 5, answerDrafts: { q1: 'not a draft' } }));
    assert.deepEqual(readSnapshot(storage, 'k'), emptySnapshot());
    assert.deepEqual(readSnapshot(null, 'k'), emptySnapshot());
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); }, removeItem: () => undefined };
    const store = createSnapshotStore(throwing, 'k', 0);
    assert.doesNotThrow(() => { store.update((s) => s); store.flush(); });
  });
});

describe('Dashboard: Continue Interview', () => {
  beforeEach(() => mock.restoreAll());

  const item = {
    interviewId: IV,
    type: 'TECHNICAL',
    difficulty: 'MEDIUM',
    focusArea: 'dbms',
    status: 'IN_PROGRESS',
    questionCount: 5,
    answeredCount: 2,
    startedAt: '2026-10-10T09:00:00.000Z',
    lastActivityAt: '2026-10-10T10:00:00.000Z',
  };
  const render = (state: InProgressState) =>
    renderToStaticMarkup(React.createElement(ContinueInterviews, { state, onRetry: () => undefined }));

  it('loads unfinished interviews with the session cookie', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => jsonResponse(200, { interviews: [item, { bad: true }], limit: 5 }));
    const state = await fetchInProgressInterviews({ apiUrl: 'http://api' });
    assert.deepEqual(state, { status: 'ready', interviews: [item] });
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, 'http://api/api/interviews/in-progress');
    assert.equal(init.credentials, 'include');
  });

  it('turns failures into a retryable error state', async () => {
    const down = await fetchInProgressInterviews({ fetchFn: (async () => jsonResponse(500, {})) as unknown as typeof fetch });
    assert.equal(down.status, 'error');
  });

  it('renders a loading state', () => {
    const html = render({ status: 'loading' });
    assert.match(html, /role="status"/);
    assert.match(html, /Checking for unfinished interviews/);
  });

  it('renders nothing when there is nothing to resume', () => {
    assert.equal(render({ status: 'ready', interviews: [] }), '');
  });

  it('renders an error with retry', () => {
    const html = render({ status: 'error', message: 'We couldn’t check for unfinished interviews.' });
    assert.match(html, /role="alert"/);
    assert.match(html, /Try again/);
  });

  it('renders each interview with progress, last activity and a Continue link to the same interview', () => {
    const html = render({ status: 'ready', interviews: [item] });
    assert.match(html, /DBMS/);
    assert.match(html, /Technical · Medium/);
    assert.match(html, /2 of 5 answered/);
    assert.match(html, /aria-valuenow="2"/);
    assert.match(html, /datetime="2026-10-10T10:00:00.000Z"/i);
    assert.match(html, new RegExp(`href="${resumeHref(IV).replace(/[?]/g, '\\?')}"`));
    assert.match(html, /Continue Interview/);
    assert.doesNotMatch(html, /href="\/interview"/, 'never links to the create flow');
  });
});
