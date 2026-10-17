import { describe, it, mock, beforeEach, before, after } from 'node:test';
import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../../app.js';
import { db } from '../../prisma/db.js';
import { authService } from '../auth/auth.service.js';
import { interviewAccess } from '../auth/interview-access.js';
import { evaluationService } from '../evaluations/evaluation.service.js';
import { aiEvaluatorService } from '../evaluations/ai-evaluator.service.js';
import { interviewHistoryService } from './interview-history.service.js';

const ALICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BOB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// ---------- A tiny in-memory stand-in for the ORM query chain ----------

interface FakeReportRow {
  id: string;
  interviewId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  overallScore: number | null;
  performanceLevel: string | null;
  summary: string | null;
  questionsEvaluated: number | null;
  reportPayload?: unknown;
  updatedAt: Date;
  interview: {
    id: string;
    ownerId: string | null;
    type: string;
    difficulty: string;
    focusArea: string;
    questionCount: number;
    createdAt: Date;
  };
}

/**
 * Evaluates the service's real where/orderBy/limit lambdas against plain rows,
 * so the filtering, ordering and limit logic is exercised without a database.
 */
const installFakeReportTable = (rows: FakeReportRow[]) => {
  const rowProxy = (row: Record<string, any>): any =>
    new Proxy({}, {
      get: (_target, key: string) =>
        key === 'interview'
          ? { some: (fn: (i: any) => boolean) => Boolean(row.interview) && fn(rowProxy(row.interview)) }
          : { eq: (value: unknown) => row[key] === value },
    });
  const orderProxy: any = new Proxy({}, {
    get: (_target, key: string) => ({ desc: () => ({ key, dir: -1 }), asc: () => ({ key, dir: 1 }) }),
  });

  const queries: Array<{ limit: number; order: Array<{ key: string; dir: number }> }> = [];

  mock.method(db.orm.public.EvaluationReport, 'where', (first: (r: any) => boolean) => {
    const wheres = [first];
    const query = { limit: Infinity, order: [] as Array<{ key: string; dir: number }> };
    queries.push(query);
    const chain: any = {
      where: (fn: (r: any) => boolean) => { wheres.push(fn); return chain; },
      select: () => chain,
      include: () => chain,
      orderBy: (fns: any) => {
        query.order = (Array.isArray(fns) ? fns : [fns]).map((fn: any) => fn(orderProxy));
        return chain;
      },
      limit: (n: number) => { query.limit = n; return chain; },
      all: async () => {
        const matched = rows.filter((row) => wheres.every((w) => w(rowProxy(row))));
        matched.sort((a: any, b: any) => {
          for (const { key, dir } of query.order) {
            if (a[key] < b[key]) return -dir;
            if (a[key] > b[key]) return dir;
          }
          return 0;
        });
        return matched.slice(0, query.limit);
      },
    };
    return chain;
  });

  return queries;
};

let seq = 0;
const report = (
  ownerId: string | null,
  completedAt: string,
  overrides: Partial<FakeReportRow> = {}
): FakeReportRow => {
  seq += 1;
  const interviewId = `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
  return {
    id: `r-${seq}`,
    interviewId,
    status: 'COMPLETED',
    overallScore: 70 + seq,
    performanceLevel: 'Proficient',
    summary: `Summary ${seq}`,
    questionsEvaluated: 5,
    reportPayload: { questions: [{ candidateAnswer: 'private answer text' }] },
    updatedAt: new Date(completedAt),
    interview: {
      id: interviewId,
      ownerId,
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      focusArea: 'dbms',
      questionCount: 5,
      createdAt: new Date(new Date(completedAt).getTime() - 30 * 60 * 1000),
    },
    ...overrides,
  };
};

describe('interviewHistoryService.listCompletedReports', () => {
  beforeEach(() => mock.restoreAll());

  it("returns only the owner's completed reports, newest first", async () => {
    const aliceOld = report(ALICE, '2026-10-01T10:00:00Z');
    const aliceNew = report(ALICE, '2026-10-12T10:00:00Z');
    const aliceMid = report(ALICE, '2026-10-05T10:00:00Z');
    const bobs = report(BOB, '2026-10-15T10:00:00Z');
    const legacy = report(null, '2026-10-16T10:00:00Z');
    const pending = report(ALICE, '2026-10-17T10:00:00Z', { status: 'PENDING' });
    const failed = report(ALICE, '2026-10-17T11:00:00Z', { status: 'FAILED' });
    installFakeReportTable([aliceOld, bobs, aliceNew, legacy, pending, aliceMid, failed]);

    const items = await interviewHistoryService.listCompletedReports(ALICE);
    assert.deepStrictEqual(items.map((i) => i.interviewId), [aliceNew.interviewId, aliceMid.interviewId, aliceOld.interviewId]);
  });

  it('respects the limit and defaults to 10', async () => {
    const rows = Array.from({ length: 14 }, (_, i) => report(ALICE, `2026-10-${String(i + 1).padStart(2, '0')}T08:00:00Z`));
    const queries = installFakeReportTable(rows);

    const firstPage = await interviewHistoryService.listCompletedReports(ALICE);
    assert.strictEqual(firstPage.length, 10);
    assert.strictEqual(queries[0].limit, 10);
    assert.strictEqual(firstPage[0].completedAt, '2026-10-14T08:00:00.000Z');

    const three = await interviewHistoryService.listCompletedReports(ALICE, 3);
    assert.strictEqual(three.length, 3);
    assert.deepStrictEqual(queries[1].order, [{ key: 'updatedAt', dir: -1 }, { key: 'id', dir: -1 }]);
  });

  it('returns a minimal summary shape without answers or the full payload', async () => {
    installFakeReportTable([report(ALICE, '2026-10-10T10:00:00Z', { summary: 'x'.repeat(500) })]);
    const [item] = await interviewHistoryService.listCompletedReports(ALICE);
    assert.deepStrictEqual(Object.keys(item).sort(), [
      'completedAt', 'difficulty', 'focusArea', 'interviewId', 'overallScore', 'performanceLevel',
      'questionCount', 'questionsEvaluated', 'reportId', 'startedAt', 'summary', 'type',
    ]);
    assert.ok(item.summary!.length <= 280);
    assert.ok(!JSON.stringify(item).includes('private answer text'));
  });

  it('returns an empty list when the user has no completed reports', async () => {
    installFakeReportTable([report(BOB, '2026-10-10T10:00:00Z'), report(ALICE, '2026-10-11T10:00:00Z', { status: 'FAILED' })]);
    assert.deepStrictEqual(await interviewHistoryService.listCompletedReports(ALICE), []);
  });
});

// ---------- HTTP ----------

describe('GET /api/interviews/history', () => {
  let server: Server;
  let base: string;

  before(() => {
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  const principalFor = (userId: string) => ({ userId, sessionId: `s-${userId}`, name: 'U', email: 'u@example.com', role: 'USER' as const });

  beforeEach(() => {
    mock.restoreAll();
    // Cookie value names the user; session storage itself is covered by the auth tests.
    mock.method(authService, 'resolveSession', async (token: string) =>
      token === 'alice' ? principalFor(ALICE) : token === 'bob' ? principalFor(BOB) : null);
  });

  const get = (path: string, user?: 'alice' | 'bob') =>
    fetch(`${base}${path}`, { headers: user ? { Cookie: `intervai_session=${user}` } : {} });

  it('requires an authenticated session', async () => {
    const list = mock.method(interviewHistoryService, 'listCompletedReports', async () => []);
    const res = await get('/api/interviews/history');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(list.mock.callCount(), 0);
  });

  it('uses the session user and ignores any user id in the query string', async () => {
    const list = mock.method(interviewHistoryService, 'listCompletedReports', async () => []);
    const res = await get(`/api/interviews/history?userId=${BOB}&ownerId=${BOB}`, 'alice');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { reports: [], limit: 10 });
    assert.deepStrictEqual(list.mock.calls[0].arguments, [ALICE, 10]);
  });

  it("never shows another user's reports", async () => {
    installFakeReportTable([report(ALICE, '2026-10-10T10:00:00Z'), report(BOB, '2026-10-11T10:00:00Z')]);
    const alice = await (await get('/api/interviews/history', 'alice')).json();
    const bob = await (await get('/api/interviews/history', 'bob')).json();
    assert.strictEqual(alice.reports.length, 1);
    assert.strictEqual(bob.reports.length, 1);
    assert.notStrictEqual(alice.reports[0].interviewId, bob.reports[0].interviewId);
  });

  it('accepts a bounded limit and rejects invalid ones', async () => {
    const list = mock.method(interviewHistoryService, 'listCompletedReports', async () => []);
    assert.strictEqual((await get('/api/interviews/history?limit=5', 'alice')).status, 200);
    assert.deepStrictEqual(list.mock.calls[0].arguments, [ALICE, 5]);
    for (const bad of ['0', '21', 'abc', '2.5']) {
      assert.strictEqual((await get(`/api/interviews/history?limit=${bad}`, 'alice')).status, 400, bad);
    }
  });

  it('is not shadowed by the /:id route and does not run the ownership check', async () => {
    mock.method(interviewHistoryService, 'listCompletedReports', async () => []);
    const ownership = mock.method(interviewAccess, 'isOwnedBy', async () => false);
    const res = await get('/api/interviews/history', 'alice');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(ownership.mock.callCount(), 0);
  });

  it('returns a safe error when loading fails', async () => {
    const errorLog = mock.method(console, 'error', () => undefined);
    mock.method(interviewHistoryService, 'listCompletedReports', async () => {
      throw Object.assign(new Error('relation "x" does not exist'), { detail: 'secret detail' });
    });
    const res = await get('/api/interviews/history', 'alice');
    assert.strictEqual(res.status, 500);
    const text = await res.text();
    assert.ok(!text.includes('secret') && !text.includes('relation'));
    assert.ok(!errorLog.mock.calls.some((c) => JSON.stringify(c.arguments).includes('secret detail')));
  });

  it('serves a saved report to its owner without generating anything, and 404s for others', async () => {
    const saved = { id: 'rep-1', interviewId: 'x', status: 'COMPLETED', overallScore: 80 };
    mock.method(interviewAccess, 'isOwnedBy', async (_id: string, userId: string) => userId === ALICE);
    const getReport = mock.method(evaluationService, 'getEvaluationReport', async () => saved);
    const generate = mock.method(evaluationService, 'generateEvaluationReport', async () => saved);
    const aiBatch = mock.method(aiEvaluatorService, 'evaluateBatch', async () => ({}) as any);
    const aiSingle = mock.method(aiEvaluatorService, 'evaluate', async () => ({}) as any);

    const id = '11111111-1111-4111-8111-111111111111';
    const own = await get(`/api/interviews/${id}/evaluation-report`, 'alice');
    assert.strictEqual(own.status, 200);
    assert.deepStrictEqual(await own.json(), saved);

    const other = await get(`/api/interviews/${id}/evaluation-report`, 'bob');
    assert.strictEqual(other.status, 404);
    assert.deepStrictEqual(await other.json(), { error: 'Interview not found' });

    assert.strictEqual(getReport.mock.callCount(), 1);
    assert.strictEqual(generate.mock.callCount(), 0);
    assert.strictEqual(aiBatch.mock.callCount() + aiSingle.mock.callCount(), 0);
  });
});
