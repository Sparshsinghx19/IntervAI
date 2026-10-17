import { describe, it, mock, beforeEach, before, after } from 'node:test';
import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../../app.js';
import { db } from '../../prisma/db.js';
import { authRepository, DuplicateEmailError, SessionRecord, UserRecord } from './auth.repository.js';
import { authRateLimiters } from './auth.route.js';
import { interviewAccess } from './interview-access.js';
import { instantFromMs } from './auth.time.js';
import { interviewRouter } from '../interviews/interview.route.js';
import { interviewService } from '../interviews/interview.service.js';
import { evaluationService } from '../evaluations/evaluation.service.js';
import { codingService } from '../coding/coding.service.js';
import { requireAuth } from './auth.middleware.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct horse battery';

// ---------- In-memory stand-ins for the database ----------

type StoredSession = SessionRecord & { tokenHash: string };
let users: Map<string, UserRecord>;
let sessions: Map<string, StoredSession>;
let interviews: Map<string, { ownerId: string | null }>;
let idSeq = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`;

const installFakeDatabase = () => {
  users = new Map();
  sessions = new Map();
  interviews = new Map();

  mock.method(authRepository, 'findUserByEmail', async (email: string) =>
    [...users.values()].find((u) => u.email === email) ?? null);
  mock.method(authRepository, 'findUserById', async (id: string) => users.get(id) ?? null);
  mock.method(authRepository, 'createUserWithSession', async (user: any, session: any) => {
    if ([...users.values()].some((u) => u.email === user.email)) throw new DuplicateEmailError();
    const created: UserRecord = { id: nextId(), role: 'USER', ...user };
    users.set(created.id, created);
    const s: StoredSession = {
      id: nextId(), userId: created.id, tokenHash: session.tokenHash, expiresAt: session.expiresAt,
      revokedAt: null, lastUsedAt: instantFromMs(Date.now()),
    };
    sessions.set(s.id, s);
    return { user: created, session: s };
  });
  mock.method(authRepository, 'createSession', async (userId: string, tokenHash: string, expiresAt: any) => {
    const s: StoredSession = { id: nextId(), userId, tokenHash, expiresAt, revokedAt: null, lastUsedAt: instantFromMs(Date.now()) };
    sessions.set(s.id, s);
    return s;
  });
  mock.method(authRepository, 'findSessionByTokenHash', async (tokenHash: string) =>
    [...sessions.values()].find((s) => s.tokenHash === tokenHash) ?? null);
  mock.method(authRepository, 'revokeSessionByTokenHash', async (tokenHash: string, at: any) => {
    for (const s of sessions.values()) if (s.tokenHash === tokenHash && !s.revokedAt) s.revokedAt = at;
  });
  mock.method(authRepository, 'touchSession', async () => undefined);

  mock.method(interviewAccess, 'isOwnedBy', async (interviewId: string, userId: string) =>
    interviews.get(interviewId)?.ownerId === userId);
};

// ---------- HTTP helpers ----------

let server: Server;
let base: string;

before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const call = async (
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; origin?: string | null } = {}
) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const origin = opts.origin === undefined ? ORIGIN : opts.origin;
  if (origin) headers.Origin = origin;
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, json, text, setCookie: res.headers.getSetCookie() };
};

const cookieFrom = (setCookie: string[]) => setCookie[0]?.split(';')[0] ?? '';

const register = async (name: string, email = `${name.toLowerCase()}@example.com`) => {
  const res = await call('POST', '/api/auth/register', { body: { name, email, password: PASSWORD } });
  assert.strictEqual(res.status, 201, `register ${name}: ${res.text}`);
  return { cookie: cookieFrom(res.setCookie), user: res.json.user };
};

const resetState = () => {
  mock.restoreAll();
  installFakeDatabase();
  Object.values(authRateLimiters).forEach((limiter) => limiter.reset());
};

// ---------- Authentication ----------

describe('Auth API', () => {
  beforeEach(resetState);

  it('registers a user, stores only an Argon2id hash and returns safe fields', async () => {
    const res = await call('POST', '/api/auth/register', {
      body: { name: ' Ada ', email: ' Ada@Example.COM ', password: PASSWORD, role: 'ADMIN' },
    });
    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(Object.keys(res.json.user).sort(), ['email', 'id', 'name', 'role']);
    assert.strictEqual(res.json.user.email, 'ada@example.com');
    assert.strictEqual(res.json.user.role, 'USER', 'public registration can never pick a role');

    const stored = [...users.values()][0];
    assert.match(stored.passwordHash, /^\$argon2id\$/);
    assert.ok(!stored.passwordHash.includes(PASSWORD));
    assert.strictEqual(stored.role, 'USER');
    assert.ok(!res.text.includes(stored.passwordHash) && !res.text.includes('passwordHash'));

    // The cookie token itself is never stored, only its hash.
    const token = cookieFrom(res.setCookie).split('=')[1];
    const session = [...sessions.values()][0];
    assert.notStrictEqual(session.tokenHash, token);
    assert.match(session.tokenHash, /^[0-9a-f]{64}$/);
    assert.ok(!res.text.includes(token), 'token must not appear in the body');
  });

  it('sets a hardened session cookie', async () => {
    const res = await call('POST', '/api/auth/register', { body: { name: 'C', email: 'c@example.com', password: PASSWORD } });
    const cookie = res.setCookie[0];
    assert.match(cookie, /^intervai_session=[A-Za-z0-9_-]{43};/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /Expires=/);
    assert.doesNotMatch(cookie, /Domain=/i);
    assert.doesNotMatch(cookie, /Secure/, 'Secure is production-only so local http works');
  });

  it('rejects duplicate emails after normalization', async () => {
    await register('Dup', 'dup@example.com');
    const res = await call('POST', '/api/auth/register', { body: { name: 'Dup2', email: '  DUP@example.com', password: PASSWORD } });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.json.code, 'EMAIL_TAKEN');
    assert.strictEqual(users.size, 1);
    assert.strictEqual(res.setCookie.length, 0);
  });

  it('returns 409 when a concurrent registration wins the unique constraint', async () => {
    mock.method(authRepository, 'findUserByEmail', async () => null);
    mock.method(authRepository, 'createUserWithSession', async () => { throw new DuplicateEmailError(); });
    const res = await call('POST', '/api/auth/register', { body: { name: 'R', email: 'r@example.com', password: PASSWORD } });
    assert.strictEqual(res.status, 409);
  });

  it('rejects invalid registration input with field errors', async () => {
    const res = await call('POST', '/api/auth/register', { body: { name: '', email: 'nope', password: '123' } });
    assert.strictEqual(res.status, 400);
    assert.ok(res.json.fieldErrors.name && res.json.fieldErrors.email && res.json.fieldErrors.password);
    assert.strictEqual(users.size, 0);
  });

  it('logs in with correct credentials and issues a fresh session', async () => {
    const { cookie: first } = await register('Lin', 'lin@example.com');
    const res = await call('POST', '/api/auth/login', { cookie: first, body: { email: 'LIN@example.com', password: PASSWORD } });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(Object.keys(res.json.user).sort(), ['email', 'id', 'name', 'role']);
    const second = cookieFrom(res.setCookie);
    assert.ok(second && second !== first);

    // The pre-login session is revoked (fixation defence); the new one works.
    assert.strictEqual((await call('GET', '/api/auth/me', { cookie: first })).status, 401);
    assert.strictEqual((await call('GET', '/api/auth/me', { cookie: second })).status, 200);
  });

  it('returns one generic error for wrong password and unknown email', async () => {
    await register('Gen', 'gen@example.com');
    const wrong = await call('POST', '/api/auth/login', { body: { email: 'gen@example.com', password: 'wrong password' } });
    const unknown = await call('POST', '/api/auth/login', { body: { email: 'ghost@example.com', password: 'wrong password' } });
    assert.strictEqual(wrong.status, 401);
    assert.strictEqual(unknown.status, 401);
    assert.deepStrictEqual(wrong.json, unknown.json);
    assert.strictEqual(wrong.json.error, 'Invalid email or password.');
    assert.strictEqual(wrong.setCookie.length, 0);
  });

  it('returns only id/name/email/role from /me and 401 when anonymous', async () => {
    const { cookie } = await register('Me', 'me@example.com');
    const me = await call('GET', '/api/auth/me', { cookie });
    assert.strictEqual(me.status, 200);
    assert.deepStrictEqual(Object.keys(me.json.user).sort(), ['email', 'id', 'name', 'role']);
    assert.ok(!/hash|token|session/i.test(me.text));

    assert.strictEqual((await call('GET', '/api/auth/me')).status, 401);
    assert.strictEqual((await call('GET', '/api/auth/me', { cookie: 'intervai_session=garbage' })).status, 401);
  });

  it('rejects expired and revoked sessions', async () => {
    const { cookie } = await register('Exp', 'exp@example.com');
    const session = [...sessions.values()][0];

    session.expiresAt = instantFromMs(Date.now() - 1000);
    const expired = await call('GET', '/api/auth/me', { cookie });
    assert.strictEqual(expired.status, 401);
    assert.match(expired.setCookie[0] ?? '', /intervai_session=;/, 'stale cookie is cleared');

    session.expiresAt = instantFromMs(Date.now() + 60_000);
    session.revokedAt = instantFromMs(Date.now());
    assert.strictEqual((await call('GET', '/api/auth/me', { cookie })).status, 401);
  });

  it('logout revokes the session, clears the cookie and is idempotent', async () => {
    const { cookie } = await register('Out', 'out@example.com');
    const res = await call('POST', '/api/auth/logout', { cookie });
    assert.strictEqual(res.status, 204);
    assert.match(res.setCookie[0], /intervai_session=;.*Expires=Thu, 01 Jan 1970/);
    assert.ok([...sessions.values()][0].revokedAt);
    assert.strictEqual((await call('GET', '/api/auth/me', { cookie })).status, 401);

    assert.strictEqual((await call('POST', '/api/auth/logout', { cookie })).status, 204);
    assert.strictEqual((await call('POST', '/api/auth/logout')).status, 204);
  });

  it('rate limits repeated login attempts for one account', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await call('POST', '/api/auth/login', { body: { email: 'target@example.com', password: 'guess' } })).status);
    }
    assert.deepStrictEqual(statuses.slice(0, 10), Array(10).fill(401));
    assert.strictEqual(statuses[10], 429);
  });

  it('blocks state-changing requests from untrusted or missing origins (CSRF)', async () => {
    const evil = await call('POST', '/api/auth/login', { origin: 'https://evil.example', body: { email: 'a@b.co', password: 'x' } });
    assert.strictEqual(evil.status, 403);
    const none = await call('POST', '/api/auth/logout', { origin: null });
    assert.strictEqual(none.status, 403);
  });

  it('answers CORS preflight for the frontend origin with credentials', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    assert.strictEqual(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');

    const other = await fetch(`${base}/api/auth/me`, { headers: { Origin: 'https://evil.example' } });
    assert.strictEqual(other.headers.get('access-control-allow-origin'), null);
  });

  it('returns JSON (no stack trace) for malformed bodies and keeps /health public', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{bad',
    });
    assert.strictEqual(res.status, 400);
    const text = await res.text();
    assert.ok(!text.includes(' at '), 'no stack trace');

    const health = await call('GET', '/health', { origin: null });
    assert.strictEqual(health.status, 200);
    assert.deepStrictEqual(health.json, { status: 'ok' });
  });
});

// ---------- Authorization ----------

describe('Interview authorization', () => {
  let alice: { cookie: string; user: any };
  let bob: { cookie: string; user: any };
  let aliceInterview: string;
  let bobInterview: string;
  let legacyInterview: string;
  const questionId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    resetState();
    alice = await register('Alice');
    bob = await register('Bob');
    aliceInterview = nextId();
    bobInterview = nextId();
    legacyInterview = nextId();
    interviews.set(aliceInterview, { ownerId: alice.user.id });
    interviews.set(bobInterview, { ownerId: bob.user.id });
    interviews.set(legacyInterview, { ownerId: null });

    const ok = (body: unknown) => async () => body;
    mock.method(interviewService, 'getInterviewById', async (id: string) => ({ id, status: 'IN_PROGRESS' }));
    mock.method(interviewService, 'getInterviewQuestions', ok([{ id: questionId }]));
    mock.method(interviewService, 'startInterview', async (id: string) => ({ id, status: 'IN_PROGRESS' }));
    mock.method(interviewService, 'submitAnswer', ok({ id: 'answer' }));
    mock.method(evaluationService, 'evaluateAnswer', ok({ id: 'evaluation' }));
    mock.method(evaluationService, 'getEvaluation', ok({ id: 'evaluation' }));
    mock.method(evaluationService, 'generateEvaluationReport', ok({ id: 'report' }));
    mock.method(evaluationService, 'getEvaluationReport', ok({ id: 'report' }));
    mock.method(codingService, 'getCodingProblem', ok({ supported: true }));
    mock.method(codingService, 'runCode', ok({ overallStatus: 'ACCEPTED' }));
    mock.method(codingService, 'submitSolution', ok({ submissionId: 's' }));
  });

  const code = { language: 'python', sourceCode: 'print(1)' };
  const routesFor = (id: string): Array<[string, string, unknown?]> => [
    ['GET', `/api/interviews/${id}`],
    ['GET', `/api/interviews/${id}/questions`],
    ['POST', `/api/interviews/${id}/start`],
    ['POST', `/api/interviews/${id}/questions/${questionId}/answer`, { answerText: 'answer' }],
    ['POST', `/api/interviews/${id}/questions/${questionId}/evaluation`],
    ['GET', `/api/interviews/${id}/questions/${questionId}/evaluation`],
    ['POST', `/api/interviews/${id}/evaluation-report`],
    ['GET', `/api/interviews/${id}/evaluation-report`],
    ['GET', `/api/interviews/${id}/questions/${questionId}/coding-problem`],
    ['POST', `/api/interviews/${id}/questions/${questionId}/code/run`, code],
    ['POST', `/api/interviews/${id}/questions/${questionId}/code/submit`, code],
  ];

  it('rejects anonymous requests on every interview route', async () => {
    assert.strictEqual((await call('POST', '/api/interviews', { body: {} })).status, 401);
    for (const [method, path, body] of routesFor(aliceInterview)) {
      const res = await call(method, path, { body });
      assert.strictEqual(res.status, 401, `${method} ${path}`);
    }
  });

  it('lets the owner use every interview route', async () => {
    for (const [method, path, body] of routesFor(aliceInterview)) {
      const res = await call(method, path, { cookie: alice.cookie, body });
      assert.ok(res.status >= 200 && res.status < 300, `${method} ${path} -> ${res.status}`);
    }
  });

  it("blocks user A from user B's interview, questions, answers, reports and coding routes", async () => {
    for (const [method, path, body] of routesFor(bobInterview)) {
      const res = await call(method, path, { cookie: alice.cookie, body });
      assert.strictEqual(res.status, 404, `${method} ${path}`);
      assert.deepStrictEqual(res.json, { error: 'Interview not found' });
    }
    // Nothing reached the services.
    assert.strictEqual((interviewService.submitAnswer as any).mock.callCount(), 0);
    assert.strictEqual((codingService.submitSolution as any).mock.callCount(), 0);
    assert.strictEqual((evaluationService.generateEvaluationReport as any).mock.callCount(), 0);
  });

  it('returns the same 404 for missing and non-owned interviews', async () => {
    const missing = await call('GET', `/api/interviews/${nextId()}`, { cookie: alice.cookie });
    const foreign = await call('GET', `/api/interviews/${bobInterview}`, { cookie: alice.cookie });
    assert.strictEqual(missing.status, 404);
    assert.deepStrictEqual(missing.json, foreign.json);
  });

  it('never exposes legacy ownerless interviews', async () => {
    for (const [method, path, body] of routesFor(legacyInterview)) {
      const res = await call(method, path, { cookie: alice.cookie, body });
      assert.strictEqual(res.status, 404, `${method} ${path}`);
    }
  });

  it('takes the interview owner from the session, not from a client-supplied userId', async () => {
    const create = mock.method(interviewService, 'createInterview', async (data: any) => ({ id: nextId(), ...data }));
    const res = await call('POST', '/api/interviews', {
      cookie: alice.cookie,
      body: { type: 'HR', difficulty: 'EASY', focusArea: 'Culture Fit', questionCount: 2, userId: bob.user.id, ownerId: bob.user.id },
    });
    assert.strictEqual(res.status, 201);
    const passed = create.mock.calls[0].arguments[0] as any;
    assert.strictEqual(passed.ownerId, alice.user.id);
    assert.ok(!('userId' in passed));
  });

  it('rejects malformed interview ids before touching the database', async () => {
    const isOwned = interviewAccess.isOwnedBy as any;
    const before = isOwned.mock.callCount();
    const res = await call('GET', '/api/interviews/not-a-uuid', { cookie: alice.cookie });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(isOwned.mock.callCount(), before);
  });

  it('rejects a question id that belongs to a different interview', async () => {
    // Use the real services with a question row that belongs to Bob's interview.
    mock.restoreAll();
    installFakeDatabase();
    const { cookie, user } = await register('Carol');
    interviews.set(aliceInterview, { ownerId: user.id });

    const foreignQuestion = { id: questionId, interviewId: bobInterview, type: 'CODING', questionText: 'q', codingProblemSlug: null };
    mock.method(db.orm.public.Interview, 'first', async () => ({ id: aliceInterview, status: 'IN_PROGRESS', questionCount: 1 }));
    mock.method(db.orm.public.Question, 'where', () => ({ first: async () => foreignQuestion }));
    mock.method(db, 'transaction', async (cb: any) => cb({
      orm: { public: {
        Interview: { first: async () => ({ id: aliceInterview, status: 'IN_PROGRESS', questionCount: 1 }) },
        Question: { where: () => ({ first: async () => foreignQuestion }) },
      } },
    }));
    const errorLog = mock.method(console, 'error', () => undefined);

    const checks: Array<[string, string, unknown?]> = [
      ['POST', `/api/interviews/${aliceInterview}/questions/${questionId}/answer`, { answerText: 'answer' }],
      ['GET', `/api/interviews/${aliceInterview}/questions/${questionId}/evaluation`],
      ['GET', `/api/interviews/${aliceInterview}/questions/${questionId}/coding-problem`],
      ['POST', `/api/interviews/${aliceInterview}/questions/${questionId}/code/run`, code],
    ];
    for (const [method, path, body] of checks) {
      const res = await call(method, path, { cookie, body });
      assert.strictEqual(res.status, 404, `${method} ${path}`);
    }
    errorLog.mock.restore();
  });

  it('guards every interview route with requireAuth plus an ownership check', () => {
    const stack = (interviewRouter as any).stack as any[];
    const firstRoute = stack.findIndex((layer) => layer.route);
    assert.ok(stack.slice(0, firstRoute).some((layer) => layer.handle === requireAuth), 'requireAuth runs before all routes');

    // User-scoped routes that address no interview id; they read the user from the session.
    const userScoped = new Set(['/', '/history']);
    for (const layer of stack.filter((l) => l.route)) {
      const path: string = layer.route.path;
      if (userScoped.has(path)) {
        assert.ok(!path.includes(':'), `${path} must not take an id`);
        continue;
      }
      const guard = layer.route.stack.find((l: any) => l.handle.ownershipParam);
      assert.ok(guard, `${path} is missing an ownership guard`);
      assert.ok(path.includes(`:${guard.handle.ownershipParam}`), `${path} guards the wrong param`);
    }
  });
});

describe('interviewAccess.isOwnedBy', () => {
  beforeEach(() => mock.restoreAll());

  it('queries by interview id AND owner id so ownerless rows never match', async () => {
    let filter: any;
    mock.method(db.orm.public.Interview, 'where', (f: any) => {
      filter = f;
      return { select: () => ({ first: async () => null }) };
    });
    const owned = await interviewAccess.isOwnedBy('iv-1', 'user-1');
    assert.strictEqual(owned, false);
    assert.deepStrictEqual(filter, { id: 'iv-1', ownerId: 'user-1' });
  });
});
