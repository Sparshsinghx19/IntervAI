import { describe, it, mock, beforeEach, before, after } from 'node:test';
import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../../app.js';
import { db } from '../../prisma/db.js';
import { authService } from '../auth/auth.service.js';
import { interviewAccess } from '../auth/interview-access.js';
import { interviewService } from './interview.service.js';
import {
  countAnsweredQuestions,
  interviewProgressService,
  lastActivityMs,
} from './interview-progress.service.js';

const ALICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BOB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// ---------- In-memory interview table for listInProgress ----------

interface FakeQuestion {
  id: string;
  type: 'THEORY' | 'CODING';
  answer: { submittedAt: Date } | null;
  submissions: Array<{ createdAt: Date }>;
}
interface FakeInterview {
  id: string;
  ownerId: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  type: string;
  difficulty: string;
  focusArea: string;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
  questions: FakeQuestion[];
}

/** Runs the service's real where/orderBy/limit lambdas against plain rows. */
const installFakeInterviews = (rows: FakeInterview[]) => {
  const proxy = (row: Record<string, any>): any =>
    new Proxy({}, {
      get: (_t, key: string) => ({
        eq: (v: unknown) => row[key] === v,
        in: (vs: unknown[]) => vs.includes(row[key]),
      }),
    });
  const orderProxy: any = new Proxy({}, { get: (_t, key: string) => ({ desc: () => ({ key, dir: -1 }) }) });
  const queries: Array<{ limit: number }> = [];

  mock.method(db.orm.public.Interview, 'where', (first: (r: any) => boolean) => {
    const wheres = [first];
    const query = { limit: Infinity, order: [] as Array<{ key: string; dir: number }> };
    queries.push(query);
    const chain: any = {
      where: (fn: any) => { wheres.push(fn); return chain; },
      select: () => chain,
      include: () => chain,
      orderBy: (fns: any) => { query.order = (Array.isArray(fns) ? fns : [fns]).map((f: any) => f(orderProxy)); return chain; },
      limit: (n: number) => { query.limit = n; return chain; },
      all: async () => {
        const matched = rows.filter((r) => wheres.every((w) => w(proxy(r))));
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
const question = (type: 'THEORY' | 'CODING', answeredAt?: string, submittedAt?: string[]): FakeQuestion => ({
  id: `q-${++seq}`,
  type,
  answer: answeredAt ? { submittedAt: new Date(answeredAt) } : null,
  submissions: (submittedAt ?? []).map((t) => ({ createdAt: new Date(t) })),
});
const interview = (ownerId: string | null, createdAt: string, overrides: Partial<FakeInterview> = {}): FakeInterview => {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    ownerId,
    status: 'IN_PROGRESS',
    type: 'TECHNICAL',
    difficulty: 'MEDIUM',
    focusArea: 'dbms',
    questionCount: 3,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    questions: [question('THEORY'), question('THEORY'), question('CODING')],
    ...overrides,
  };
};

describe('Progress calculations', () => {
  it('counts answered questions with the same rule as interview completion', () => {
    const qs = [
      question('THEORY', '2026-10-01T10:00:00Z'),
      question('THEORY'),
      question('CODING', undefined, ['2026-10-01T11:00:00Z', '2026-10-01T12:00:00Z']),
      // A coding question only counts once code is submitted, not for a text answer.
      question('CODING', '2026-10-01T13:00:00Z'),
    ];
    assert.strictEqual(countAnsweredQuestions(qs), 2);
  });

  it('takes last activity from the newest answer or submission', () => {
    const qs = [question('THEORY', '2026-10-02T10:00:00Z'), question('CODING', undefined, ['2026-10-03T09:00:00Z'])];
    const ms = lastActivityMs({ createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-01T00:00:00Z') }, qs);
    assert.strictEqual(new Date(ms).toISOString(), '2026-10-03T09:00:00.000Z');
  });
});

describe('interviewProgressService.listInProgress', () => {
  beforeEach(() => mock.restoreAll());

  it("returns only the owner's unfinished interviews, most recent activity first", async () => {
    const quiet = interview(ALICE, '2026-10-05T10:00:00Z');
    const active = interview(ALICE, '2026-10-01T10:00:00Z', {
      status: 'NOT_STARTED',
      questions: [question('THEORY', '2026-10-09T10:00:00Z'), question('THEORY')],
    });
    const completed = interview(ALICE, '2026-10-08T10:00:00Z', { status: 'COMPLETED' });
    const bobs = interview(BOB, '2026-10-08T10:00:00Z');
    const legacy = interview(null, '2026-10-08T10:00:00Z');
    const empty = interview(ALICE, '2026-10-07T10:00:00Z', { questions: [] });
    installFakeInterviews([quiet, active, completed, bobs, legacy, empty]);

    const list = await interviewProgressService.listInProgress(ALICE);
    assert.deepStrictEqual(list.map((i) => i.interviewId), [active.id, quiet.id]);
    assert.strictEqual(list[0].lastActivityAt, '2026-10-09T10:00:00.000Z');
    assert.deepStrictEqual([list[0].answeredCount, list[0].questionCount], [1, 2]);
  });

  it('excludes completed interviews even when their report failed', async () => {
    // A failed report leaves the interview COMPLETED; it belongs to Reports, not Continue.
    installFakeInterviews([interview(ALICE, '2026-10-01T10:00:00Z', { status: 'COMPLETED' })]);
    assert.deepStrictEqual(await interviewProgressService.listInProgress(ALICE), []);
  });

  it('respects the limit and returns no answer text or code', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => interview(ALICE, `2026-10-0${i + 1}T10:00:00Z`));
    installFakeInterviews(rows);
    const list = await interviewProgressService.listInProgress(ALICE, 3);
    assert.strictEqual(list.length, 3);
    assert.strictEqual(list[0].interviewId, rows[7].id);
    assert.deepStrictEqual(Object.keys(list[0]).sort(), [
      'answeredCount', 'difficulty', 'focusArea', 'interviewId', 'lastActivityAt', 'questionCount', 'startedAt', 'status', 'type',
    ]);
  });
});

describe('interviewProgressService.getProgress', () => {
  beforeEach(() => mock.restoreAll());

  it('returns saved answers and only the latest code submission per question', async () => {
    const IV = '11111111-1111-4111-8111-111111111111';
    mock.method(db.orm.public.Interview, 'first', async () => ({ id: IV, status: 'IN_PROGRESS' }));
    mock.method(db.orm.public.Question, 'where', () => ({ select: () => ({ all: async () => [{ id: 'q1' }, { id: 'q2' }] }) }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      all: async () => [{ questionId: 'q1', answerText: 'My answer', submittedAt: new Date('2026-10-01T10:00:00Z') }],
    }));
    mock.method(db.orm.public.CodeSubmission, 'where', () => ({
      orderBy: () => ({
        all: async () => [
          { id: 's2', questionId: 'q2', language: 'python', sourceCode: 'print(2)', status: 'ACCEPTED', testsPassed: 3, totalTests: 3, createdAt: new Date('2026-10-02T10:00:00Z') },
          { id: 's1', questionId: 'q2', language: 'cpp', sourceCode: 'int main(){}', status: 'WRONG_ANSWER', testsPassed: 1, totalTests: 3, createdAt: new Date('2026-10-01T10:00:00Z') },
        ],
      }),
    }));

    const progress = await interviewProgressService.getProgress(IV);
    assert.deepStrictEqual(progress?.answers, [{ questionId: 'q1', answerText: 'My answer', submittedAt: '2026-10-01T10:00:00.000Z' }]);
    assert.strictEqual(progress?.codeSubmissions.length, 1);
    assert.strictEqual(progress?.codeSubmissions[0].sourceCode, 'print(2)');
  });

  it('returns null for a missing interview', async () => {
    mock.method(db.orm.public.Interview, 'first', async () => null);
    assert.strictEqual(await interviewProgressService.getProgress('x'), null);
  });
});

// ---------- HTTP ----------

describe('Resume endpoints', () => {
  let server: Server;
  let base: string;
  before(() => {
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  const principal = (userId: string) => ({ userId, sessionId: `s-${userId}`, name: 'U', email: 'u@example.com', role: 'USER' as const });
  beforeEach(() => {
    mock.restoreAll();
    mock.method(authService, 'resolveSession', async (token: string) =>
      token === 'alice' ? principal(ALICE) : token === 'bob' ? principal(BOB) : null);
  });
  const get = (path: string, user?: 'alice' | 'bob') =>
    fetch(`${base}${path}`, { headers: user ? { Cookie: `intervai_session=${user}` } : {} });

  it('GET /in-progress requires a session and uses only the session user', async () => {
    const list = mock.method(interviewProgressService, 'listInProgress', async () => []);
    assert.strictEqual((await get('/api/interviews/in-progress')).status, 401);
    assert.strictEqual(list.mock.callCount(), 0);

    const res = await get(`/api/interviews/in-progress?userId=${BOB}`, 'alice');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { interviews: [], limit: 5 });
    assert.deepStrictEqual(list.mock.calls[0].arguments, [ALICE, 5]);
  });

  it("GET /in-progress never lists another user's interviews", async () => {
    installFakeInterviews([interview(ALICE, '2026-10-01T10:00:00Z'), interview(BOB, '2026-10-02T10:00:00Z'), interview(BOB, '2026-10-03T10:00:00Z')]);
    const alice = await (await get('/api/interviews/in-progress', 'alice')).json();
    const bob = await (await get('/api/interviews/in-progress', 'bob')).json();
    assert.strictEqual(alice.interviews.length, 1);
    assert.strictEqual(bob.interviews.length, 2);
  });

  it('GET /in-progress validates the limit, is not shadowed by /:id and fails safely', async () => {
    const ownership = mock.method(interviewAccess, 'isOwnedBy', async () => false);
    mock.method(interviewProgressService, 'listInProgress', async () => []);
    assert.strictEqual((await get('/api/interviews/in-progress?limit=11', 'alice')).status, 400);
    assert.strictEqual((await get('/api/interviews/in-progress?limit=2', 'alice')).status, 200);
    assert.strictEqual(ownership.mock.callCount(), 0);

    const errorLog = mock.method(console, 'error', () => undefined);
    mock.method(interviewProgressService, 'listInProgress', async () => {
      throw Object.assign(new Error('boom'), { detail: 'secret detail' });
    });
    const res = await get('/api/interviews/in-progress', 'alice');
    assert.strictEqual(res.status, 500);
    assert.ok(!(await res.text()).includes('secret'));
    errorLog.mock.restore();
  });

  it('GET /:id/progress is limited to the owner and never creates or evaluates anything', async () => {
    const IV = '11111111-1111-4111-8111-111111111111';
    mock.method(interviewAccess, 'isOwnedBy', async (_id: string, userId: string) => userId === ALICE);
    const progress = mock.method(interviewProgressService, 'getProgress', async () => ({
      interviewId: IV, status: 'IN_PROGRESS', answers: [], codeSubmissions: [],
    }));
    const create = mock.method(interviewService, 'createInterview', async () => ({}));

    assert.strictEqual((await get(`/api/interviews/${IV}/progress`)).status, 401);
    assert.strictEqual((await get(`/api/interviews/${IV}/progress`, 'bob')).status, 404);
    const own = await get(`/api/interviews/${IV}/progress`, 'alice');
    assert.strictEqual(own.status, 200);
    assert.strictEqual((await own.json()).interviewId, IV);
    assert.strictEqual(progress.mock.callCount(), 1);
    assert.strictEqual(create.mock.callCount(), 0);
  });
});
