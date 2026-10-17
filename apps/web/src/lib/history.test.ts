import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  fetchInterviewHistory,
  formatCompletedDate,
  formatFocusArea,
  formatInterviewType,
  HistoryState,
  InterviewHistoryItem,
  loadSavedReport,
  scoreTone,
} from './history-api';
import { ReportHistoryView } from '../components/reports/ReportHistoryView';
import { ReportUnavailable } from '../components/reports/ReportDetail';

const IV1 = '11111111-1111-4111-8111-111111111111';
const IV2 = '22222222-2222-4222-8222-222222222222';

const item = (overrides: Partial<InterviewHistoryItem> = {}): InterviewHistoryItem => ({
  interviewId: IV1,
  reportId: 'r1',
  type: 'TECHNICAL',
  difficulty: 'MEDIUM',
  focusArea: 'dbms',
  questionCount: 5,
  questionsEvaluated: 5,
  overallScore: 82,
  performanceLevel: 'Advanced',
  summary: 'Strong grasp of transactions; revisit indexing trade-offs.',
  startedAt: '2026-10-12T09:30:00.000Z',
  completedAt: '2026-10-12T10:00:00.000Z',
  ...overrides,
});

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

type Call = { url: string; init?: RequestInit };
const recordingFetch = (response: Response | (() => Promise<Response>)) => {
  const calls: Call[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return typeof response === 'function' ? response() : response;
  }) as unknown as typeof fetch;
  return { fn, calls };
};

const render = (state: HistoryState) =>
  renderToStaticMarkup(React.createElement(ReportHistoryView, { state, onRetry: () => undefined }));

describe('History API client', () => {
  beforeEach(() => mock.restoreAll());

  it('loads reports with the session cookie and keeps only well-formed items', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () =>
      jsonResponse(200, { reports: [item(), { nope: true }, item({ interviewId: IV2, overallScore: null })], limit: 10 }));

    const result = await fetchInterviewHistory({ apiUrl: 'http://api' });
    assert.equal(result.status, 'ready');
    assert.deepEqual(result.status === 'ready' && result.reports.map((r) => r.interviewId), [IV1, IV2]);

    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, 'http://api/api/interviews/history');
    assert.equal(init.credentials, 'include');
    assert.equal(init.method, undefined, 'a plain GET');
  });

  it('turns server, auth and network failures into safe error states', async () => {
    const server = await fetchInterviewHistory({ fetchFn: recordingFetch(jsonResponse(500, { error: 'SqlQueryError at …' })).fn });
    assert.equal(server.status, 'error');
    assert.doesNotMatch(server.status === 'error' ? server.message : '', /Sql/);

    const expired = await fetchInterviewHistory({ fetchFn: recordingFetch(jsonResponse(401, {})).fn });
    assert.match(expired.status === 'error' ? expired.message : '', /session has expired/);

    const offline = await fetchInterviewHistory({
      fetchFn: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch,
    });
    assert.match(offline.status === 'error' ? offline.message : '', /Could not reach the server/);

    const malformed = await fetchInterviewHistory({ fetchFn: recordingFetch(jsonResponse(200, { nope: 1 })).fn });
    assert.equal(malformed.status, 'error');
  });
});

describe('Saved report loading (read-only)', () => {
  const completed = { id: 'rep', interviewId: IV1, status: 'COMPLETED', overallScore: 90, reportPayload: { questions: [] } };

  it('returns a completed report using a GET of the saved report only', async () => {
    const { fn, calls } = recordingFetch(jsonResponse(200, completed));
    const state = await loadSavedReport(IV1, { fetchFn: fn, apiUrl: 'http://api' });
    assert.equal(state.status, 'ready');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `http://api/api/interviews/${IV1}/evaluation-report`);
    assert.ok(!calls[0].init || !calls[0].init.method || calls[0].init.method === 'GET', 'never POSTs (no generation)');
  });

  it('reports pending, failed and missing reports as unavailable without generating one', async () => {
    const pending = await loadSavedReport(IV1, { fetchFn: recordingFetch(jsonResponse(200, { ...completed, status: 'PENDING' })).fn });
    assert.deepEqual(pending, { status: 'unavailable', reason: 'pending' });

    const failed = await loadSavedReport(IV1, { fetchFn: recordingFetch(jsonResponse(200, { ...completed, status: 'FAILED' })).fn });
    assert.deepEqual(failed, { status: 'unavailable', reason: 'failed' });

    // 404 covers both "no report" and "not your interview".
    const missing = await loadSavedReport(IV1, { fetchFn: recordingFetch(jsonResponse(404, { error: 'Interview not found' })).fn });
    assert.deepEqual(missing, { status: 'unavailable', reason: 'missing' });

    const errored = await loadSavedReport(IV1, { fetchFn: recordingFetch(jsonResponse(500, {})).fn });
    assert.equal(errored.status, 'error');
  });

  it('does not call the API for a malformed interview id', async () => {
    const { fn, calls } = recordingFetch(jsonResponse(200, completed));
    assert.deepEqual(await loadSavedReport('../../auth/me', { fetchFn: fn }), { status: 'unavailable', reason: 'missing' });
    assert.equal(calls.length, 0);
  });
});

describe('My Reports view states', () => {
  it('renders a loading state', () => {
    const html = render({ status: 'loading' });
    assert.match(html, /role="status"/);
    assert.match(html, /Loading your reports/);
  });

  it('renders an empty state with a way to start an interview', () => {
    const html = render({ status: 'ready', reports: [] });
    assert.match(html, /No reports yet/);
    assert.match(html, /href="\/interview"/);
    assert.match(html, /Start your first interview/);
  });

  it('renders an error state with a retry action', () => {
    const html = render({ status: 'error', message: 'We could not load your reports right now. Please try again.' });
    assert.match(html, /role="alert"/);
    assert.match(html, /We could not load your reports right now/);
    assert.match(html, /Try again/);
  });

  it('renders report cards with metadata, score, date and a View report link', () => {
    const html = render({
      status: 'ready',
      reports: [item(), item({ interviewId: IV2, focusArea: 'system-design', overallScore: null, performanceLevel: null })],
    });
    assert.match(html, /DBMS/);
    assert.match(html, /Technical · Medium · 5 questions/);
    assert.match(html, />82</);
    assert.match(html, /Advanced/);
    assert.match(html, /datetime="2026-10-12T10:00:00.000Z"/i);
    assert.match(html, new RegExp(`href="/reports/${IV1}"`));
    assert.match(html, new RegExp(`href="/reports/${IV2}"`));
    assert.match(html, /System Design/);
    assert.match(html, /N\/A/);
    assert.equal((html.match(/>View report</g) || []).length, 2);
  });
});

describe('Report unavailable states', () => {
  const renderUnavailable = (state: Parameters<typeof ReportUnavailable>[0]['state']) =>
    renderToStaticMarkup(React.createElement(ReportUnavailable, { state, interviewId: IV1, onRetry: () => undefined }));

  it('explains a missing report and links back to My Reports', () => {
    const html = renderUnavailable({ status: 'unavailable', reason: 'missing' });
    assert.match(html, /Report not available/);
    assert.match(html, /href="\/reports"/);
    assert.doesNotMatch(html, /interview\/session/);
  });

  it('offers the interview session (an explicit user action) only for failed reports', () => {
    const html = renderUnavailable({ status: 'unavailable', reason: 'failed' });
    assert.match(html, new RegExp(`href="/interview/session\\?id=${IV1}"`));
  });

  it('shows a retry for load errors', () => {
    const html = renderUnavailable({ status: 'error', message: 'We could not load this report right now. Please try again.' });
    assert.match(html, /role="alert"/);
    assert.match(html, /Try again/);
  });
});

describe('History formatting helpers', () => {
  it('maps stored values to readable labels', () => {
    assert.equal(formatFocusArea('dsa'), 'Data Structures & Algorithms');
    assert.equal(formatFocusArea('Culture Fit'), 'Culture Fit');
    assert.equal(formatFocusArea('leadership_skills'), 'Leadership Skills');
    assert.equal(formatInterviewType('BEHAVIORAL'), 'Behavioral');
  });

  it('formats dates and score bands', () => {
    assert.equal(formatCompletedDate('2026-10-12T10:00:00.000Z', 'UTC'), 'Oct 12, 2026, 10:00 AM');
    assert.equal(formatCompletedDate('not a date'), 'Date unavailable');
    assert.deepEqual([90, 75, 60, 20, null].map(scoreTone), ['excellent', 'strong', 'steady', 'developing', 'none']);
  });
});
