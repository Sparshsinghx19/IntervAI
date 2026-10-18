import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DashboardState, DashboardSummary, firstName, formatScore, loadDashboard } from './dashboard-api';
import type { InterviewHistoryItem } from './history-api';
import { DashboardBody, DashboardHeader } from '../components/dashboard/DashboardView';

const IV1 = '11111111-1111-4111-8111-111111111111';
const IV2 = '22222222-2222-4222-8222-222222222222';
const IV3 = '33333333-3333-4333-8333-333333333333';

const summary = (overrides: Partial<DashboardSummary> = {}): DashboardSummary => ({
  completedInterviews: 4,
  scoredReports: 3,
  averageScore: 77.7,
  bestScore: 91,
  bestReport: { interviewId: IV2, type: 'BEHAVIORAL', focusArea: 'Conflict Resolution', completedAt: '2026-10-15T10:00:00.000Z' },
  lastCompletedAt: '2026-10-17T10:00:00.000Z',
  ...overrides,
});

const item = (interviewId: string, overrides: Partial<InterviewHistoryItem> = {}): InterviewHistoryItem => ({
  interviewId,
  reportId: `r-${interviewId.slice(0, 4)}`,
  type: 'TECHNICAL',
  difficulty: 'MEDIUM',
  focusArea: 'dbms',
  questionCount: 5,
  questionsEvaluated: 5,
  overallScore: 82,
  performanceLevel: 'Proficient',
  summary: 'Good.',
  startedAt: '2026-10-17T09:30:00.000Z',
  completedAt: '2026-10-17T10:00:00.000Z',
  ...overrides,
});

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

/** Routes requests by URL so summary and history can fail independently. */
const routedFetch = (routes: { summary: () => Response; history: () => Response }) => {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(url);
    if (url.includes('/api/interviews/summary')) return routes.summary();
    if (url.includes('/api/interviews/history')) return routes.history();
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  return { fn, urls };
};

const render = (state: DashboardState) =>
  renderToStaticMarkup(React.createElement(DashboardBody, { state, onRetry: () => undefined }));

describe('Dashboard data loading', () => {
  beforeEach(() => mock.restoreAll());

  it('loads the summary and the five most recent reports with the session cookie', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async (url: string) =>
      url.includes('/summary') ? jsonResponse(200, summary()) : jsonResponse(200, { reports: [item(IV1)], limit: 5 }));

    const state = await loadDashboard({ apiUrl: 'http://api' });
    assert.equal(state.status, 'ready');
    assert.deepEqual(state.status === 'ready' && state.summary, summary());

    const calls = fetchMock.mock.calls.map((c) => c.arguments as [string, RequestInit]);
    assert.deepEqual(calls.map(([u]) => u).sort(), ['http://api/api/interviews/history?limit=5', 'http://api/api/interviews/summary']);
    assert.ok(calls.every(([, init]) => init.credentials === 'include' && !init.method));
  });

  it('shows an error state when either request fails, rather than partial or zero data', async () => {
    const summaryDown = await loadDashboard({
      fetchFn: routedFetch({ summary: () => jsonResponse(500, {}), history: () => jsonResponse(200, { reports: [] }) }).fn,
    });
    assert.equal(summaryDown.status, 'error');

    const historyDown = await loadDashboard({
      fetchFn: routedFetch({ summary: () => jsonResponse(200, summary()), history: () => jsonResponse(503, {}) }).fn,
    });
    assert.equal(historyDown.status, 'error');

    const malformed = await loadDashboard({
      fetchFn: routedFetch({ summary: () => jsonResponse(200, { completedInterviews: 'lots' }), history: () => jsonResponse(200, { reports: [] }) }).fn,
    });
    assert.equal(malformed.status, 'error');

    const offline = await loadDashboard({
      fetchFn: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch,
    });
    assert.equal(offline.status, 'error');
    assert.match(offline.status === 'error' ? offline.message : '', /try again/i);
  });

  it('keeps unavailable scores as null instead of inventing values', async () => {
    const state = await loadDashboard({
      fetchFn: routedFetch({
        summary: () => jsonResponse(200, summary({ scoredReports: 0, averageScore: null, bestScore: null, bestReport: null })),
        history: () => jsonResponse(200, { reports: [item(IV1, { overallScore: null })] }),
      }).fn,
    });
    assert.equal(state.status, 'ready');
    if (state.status === 'ready') {
      assert.equal(state.summary.averageScore, null);
      assert.equal(state.summary.bestScore, null);
    }
  });
});

describe('Dashboard formatting', () => {
  it('formats scores on the report scale', () => {
    assert.equal(formatScore(91), '91');
    assert.equal(formatScore(77.66), '77.7');
    assert.equal(formatScore(0), '0');
    assert.equal(formatScore(null), '—');
  });

  it('uses the first name for the greeting', () => {
    assert.equal(firstName('Priya Sharma'), 'Priya');
    assert.equal(firstName('  '), '');
    assert.equal(firstName(undefined), '');
  });
});

describe('Dashboard states', () => {
  it('renders a layout-matched loading skeleton', () => {
    const html = render({ status: 'loading' });
    assert.match(html, /role="status"/);
    assert.match(html, /Loading your dashboard/);
    assert.doesNotMatch(html, /Average score/);
  });

  it('renders an error with a retry action', () => {
    const html = render({ status: 'error', message: 'We couldn’t load your dashboard. Check your connection and try again.' });
    assert.match(html, /role="alert"/);
    assert.match(html, /couldn’t load your dashboard/);
    assert.match(html, /Try again/);
  });

  it('shows a first-interview guide instead of zero metrics for new candidates', () => {
    const html = render({
      status: 'ready',
      summary: summary({ completedInterviews: 0, scoredReports: 0, averageScore: null, bestScore: null, bestReport: null, lastCompletedAt: null }),
      recent: [],
    });
    assert.match(html, /Start your first interview/);
    assert.match(html, /href="\/interview"/);
    assert.doesNotMatch(html, /Average score|Best score|Completed interviews/);
  });

  it('renders metrics from the summary and a row per recent report', () => {
    const html = render({
      status: 'ready',
      summary: summary(),
      recent: [item(IV1), item(IV2, { focusArea: 'Conflict Resolution', type: 'BEHAVIORAL', overallScore: 91 }), item(IV3, { overallScore: null })],
    });
    // Metrics
    assert.match(html, /Completed interviews/);
    assert.match(html, />4</);
    assert.match(html, />77\.7</);
    assert.match(html, /Across 3 scored reports · 1 without a score/);
    assert.match(html, />91</);
    assert.match(html, new RegExp(`href="/reports/${IV2}"[^>]*>Conflict Resolution`));
    // Recent reports
    for (const id of [IV1, IV2, IV3]) assert.match(html, new RegExp(`href="/reports/${id}"`));
    assert.match(html, /DBMS/);
    assert.match(html, /Technical · Medium/);
    assert.match(html, /No score/);
    assert.equal((html.match(/View report<span class="sr-only">/g) || []).length, 3);
    // Totals come from the summary, not the visible rows
    assert.match(html, /Showing 3 of 4 reports/);
    assert.match(html, /href="\/reports"[^>]*>View all reports/);
  });

  it('shows an unavailable state when no report has a score', () => {
    const html = render({
      status: 'ready',
      summary: summary({ completedInterviews: 1, scoredReports: 0, averageScore: null, bestScore: null, bestReport: null }),
      recent: [item(IV1, { overallScore: null })],
    });
    assert.equal((html.match(/No scored reports yet/g) || []).length, 2);
    assert.match(html, />—</);
    assert.doesNotMatch(html, /\/ 100/);
  });
});

describe('Dashboard header', () => {
  const header = (name: string | undefined, state: DashboardState) =>
    renderToStaticMarkup(React.createElement(DashboardHeader, { name, state }));

  it('greets the user by first name and links to interview setup', () => {
    const html = header('Priya Sharma', { status: 'ready', summary: summary(), recent: [] });
    assert.match(html, /Welcome, Priya/);
    assert.match(html, /You have completed 4 interviews\./);
    assert.match(html, /href="\/interview"[^>]*>.*Start New Interview/);
  });

  it('falls back gracefully without a name and while loading', () => {
    const html = header(undefined, { status: 'loading' });
    assert.match(html, /Welcome</);
    assert.match(html, /at a glance/);
  });
});
