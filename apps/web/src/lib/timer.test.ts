import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  clockOffsetMs,
  finalizeInterview,
  formatRemaining,
  InterviewTiming,
  parseTiming,
  remainingMs,
  startInterviewClock,
  timeWarning,
} from './interview-timer';
import { saveInterviewAnswer, submitAnswerAndEvaluate } from './evaluation-api';

const IV = '11111111-1111-4111-8111-111111111111';

const timing = (overrides: Partial<InterviewTiming> = {}): InterviewTiming => ({
  status: 'IN_PROGRESS',
  durationMinutes: 30,
  startedAt: '2026-10-18T10:00:00.000Z',
  deadlineAt: '2026-10-18T10:30:00.000Z',
  completedAt: null,
  completionReason: null,
  serverNow: '2026-10-18T10:00:00.000Z',
  ...overrides,
});

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('Interview countdown (derived from the server deadline)', () => {
  it('computes time remaining from the deadline, corrected for clock skew', () => {
    const t = timing();
    // This browser's clock runs 2 minutes behind the server.
    const receivedAt = Date.parse('2026-10-18T09:58:00.000Z');
    const offset = clockOffsetMs(t, receivedAt);
    assert.equal(offset, 120_000);
    // Five browser-minutes later the server clock reads 10:05, so 25 minutes remain.
    assert.equal(remainingMs(t, offset, receivedAt + 5 * 60_000), 25 * 60_000);
  });

  it('never counts below zero and is null for untimed interviews', () => {
    assert.equal(remainingMs(timing(), 0, Date.parse('2026-10-18T11:00:00.000Z')), 0);
    assert.equal(remainingMs(timing({ deadlineAt: null, durationMinutes: null }), 0, Date.now()), null);
  });

  it('warns at five minutes and one minute, then reports expiry', () => {
    assert.equal(timeWarning(null), 'none');
    assert.equal(timeWarning(10 * 60_000), 'none');
    assert.equal(timeWarning(5 * 60_000), 'five-minutes');
    assert.equal(timeWarning(60_000), 'one-minute');
    assert.equal(timeWarning(0), 'expired');
  });

  it('formats remaining time, rounding up so 00:00 means time is really up', () => {
    assert.equal(formatRemaining(25 * 60_000), '25:00');
    assert.equal(formatRemaining(59_001), '01:00');
    assert.equal(formatRemaining(400), '00:01');
    assert.equal(formatRemaining(0), '00:00');
    assert.equal(formatRemaining(61 * 60_000), '1:01:00');
  });

  it('parses only well-formed timing', () => {
    assert.deepEqual(parseTiming(timing()), timing());
    assert.equal(parseTiming({ status: 'IN_PROGRESS' }), null);
    assert.equal(parseTiming(null), null);
  });
});

describe('Interview clock API', () => {
  beforeEach(() => mock.restoreAll());

  it('starts the clock with a credentialed POST and returns the server deadline', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => jsonResponse(200, { id: IV, status: 'IN_PROGRESS', timing: timing() }));
    const result = await startInterviewClock(IV, { apiUrl: 'http://api' });
    assert.equal(result?.deadlineAt, timing().deadlineAt);
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, `http://api/api/interviews/${IV}/start`);
    assert.equal(init.method, 'POST');
    assert.equal(init.credentials, 'include');
  });

  it('reports finalize outcomes from the server, which decides when time is up', async () => {
    const done = await finalizeInterview(IV, { fetchFn: (async () => jsonResponse(200, { timing: timing({ status: 'COMPLETED' }) })) as unknown as typeof fetch });
    assert.equal(done.result, 'finalized');
    const early = await finalizeInterview(IV, { fetchFn: (async () => jsonResponse(409, { timing: timing() })) as unknown as typeof fetch });
    assert.equal(early.result, 'not-yet');
    const down = await finalizeInterview(IV, { fetchFn: (async () => { throw new Error('offline'); }) as unknown as typeof fetch });
    assert.equal(down.result, 'error');
  });
});

describe('Submitting after the time limit', () => {
  it('does not claim an answer was saved when the server refused it for time', async () => {
    const expired = await saveInterviewAnswer({
      interviewId: IV, questionId: 'q1', answerText: 'late',
      fetchFn: (async () => jsonResponse(409, { error: 'The time limit for this interview has ended.', reason: 'TIME_EXPIRED' })) as unknown as typeof fetch,
    });
    assert.equal(expired.success, false);
    assert.equal(expired.expired, true);

    // A 409 for an interview that was already completed keeps its old meaning (answer on record).
    const completed = await saveInterviewAnswer({
      interviewId: IV, questionId: 'q1', answerText: 'x',
      fetchFn: (async () => jsonResponse(409, { error: 'Interview is already completed', reason: 'COMPLETED' })) as unknown as typeof fetch,
    });
    assert.equal(completed.success, true);
  });

  it('stops the answer-and-evaluate flow at the time limit without requesting an evaluation', async () => {
    const calls: string[] = [];
    const result = await submitAnswerAndEvaluate({
      interviewId: IV, questionId: 'q1', answerText: 'late',
      fetchFn: (async (url: string) => {
        calls.push(url);
        return jsonResponse(409, { reason: 'TIME_EXPIRED', error: 'ended' });
      }) as unknown as typeof fetch,
    });
    assert.equal(result.success, false);
    assert.equal(calls.length, 1, 'no evaluation request after a refused answer');
  });
});
