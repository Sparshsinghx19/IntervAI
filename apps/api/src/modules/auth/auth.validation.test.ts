import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeEmail, validateLogin, validateRegistration } from './auth.validation.js';
import { loadAuthConfig } from './auth.config.js';
import { createRateLimiter } from './rate-limit.js';

describe('Auth validation', () => {
  it('normalizes emails consistently (trim + lowercase)', () => {
    assert.strictEqual(normalizeEmail('  Alice@Example.COM '), 'alice@example.com');
  });

  it('accepts a valid registration and normalizes name and email', () => {
    const result = validateRegistration({ name: '  Ada   Lovelace ', email: ' ADA@Example.com', password: 'long enough pw' });
    assert.ok(result.ok);
    assert.deepStrictEqual(result.value, { name: 'Ada Lovelace', email: 'ada@example.com', password: 'long enough pw' });
  });

  it('rejects missing and malformed registration fields with per-field messages', () => {
    const result = validateRegistration({ name: '', email: 'not-an-email', password: 'short' });
    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.name);
    assert.ok(result.fieldErrors.email);
    assert.match(result.fieldErrors.password!, /at least 8/);
  });

  it('rejects overly long passwords and names, and non-object bodies', () => {
    const long = validateRegistration({ name: 'x'.repeat(81), email: 'a@b.co', password: 'p'.repeat(129) });
    assert.ok(!long.ok);
    assert.ok(long.fieldErrors.name && long.fieldErrors.password);

    const empty = validateRegistration(null);
    assert.ok(!empty.ok);
    assert.deepStrictEqual(Object.keys(empty.fieldErrors).sort(), ['email', 'name', 'password']);
  });

  it('ignores any role or id supplied in the registration body', () => {
    const result = validateRegistration({ name: 'Eve', email: 'eve@example.com', password: 'password123', role: 'ADMIN', id: 'x' });
    assert.ok(result.ok);
    assert.deepStrictEqual(Object.keys(result.value).sort(), ['email', 'name', 'password']);
  });

  it('validates login input', () => {
    assert.ok(validateLogin({ email: 'A@B.co', password: 'x' }).ok);
    const bad = validateLogin({ email: '', password: '' });
    assert.ok(!bad.ok);
    assert.ok(bad.fieldErrors.email && bad.fieldErrors.password);
  });
});

describe('Auth config', () => {
  it('uses non-Secure host-only Lax cookies in development', () => {
    const config = loadAuthConfig({ NODE_ENV: 'development' });
    assert.strictEqual(config.cookieSecure, false);
    assert.strictEqual(config.cookieSameSite, 'lax');
    assert.strictEqual(config.cookieName, 'intervai_session');
    assert.deepStrictEqual(config.allowedOrigins, ['http://localhost:3000']);
    assert.strictEqual(config.sessionTtlMs, 7 * 24 * 60 * 60 * 1000);
  });

  it('forces Secure and the __Host- prefix in production', () => {
    const config = loadAuthConfig({ NODE_ENV: 'production', FRONTEND_ORIGINS: 'https://app.example.com' });
    assert.strictEqual(config.cookieSecure, true);
    assert.strictEqual(config.cookieName, '__Host-intervai_session');
  });

  it('requires Secure for SameSite=None and honours a configured lifetime', () => {
    const config = loadAuthConfig({ AUTH_COOKIE_SAMESITE: 'none', AUTH_SESSION_TTL_HOURS: '2' });
    assert.strictEqual(config.cookieSecure, true);
    assert.strictEqual(config.sessionTtlMs, 2 * 60 * 60 * 1000);
  });

  it('rejects wildcard or malformed origins', () => {
    assert.throws(() => loadAuthConfig({ FRONTEND_ORIGINS: '*' }));
    assert.throws(() => loadAuthConfig({ FRONTEND_ORIGINS: 'http://localhost:3000/path' }));
    assert.throws(() => loadAuthConfig({ AUTH_SESSION_TTL_HOURS: '-1' }));
  });
});

describe('Rate limiter', () => {
  const runLimiter = (limiter: ReturnType<typeof createRateLimiter>) => {
    let status = 200;
    let nextCalled = false;
    const res: any = {
      setHeader: () => undefined,
      status(code: number) { status = code; return this; },
      json() { return this; },
    };
    limiter({ ip: '1.2.3.4' } as any, res, () => { nextCalled = true; });
    return nextCalled ? 200 : status;
  };

  it('blocks after the limit and resets after the window', () => {
    let clock = 0;
    const limiter = createRateLimiter({ windowMs: 1000, max: 2, key: (req) => req.ip ?? null, now: () => clock });
    assert.strictEqual(runLimiter(limiter), 200);
    assert.strictEqual(runLimiter(limiter), 200);
    assert.strictEqual(runLimiter(limiter), 429);
    clock = 1001;
    assert.strictEqual(runLimiter(limiter), 200);
  });

  it('keeps memory bounded when many keys are used', () => {
    let n = 0;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5, maxKeys: 50, key: () => `k${n++}` });
    for (let i = 0; i < 500; i++) runLimiter(limiter);
    assert.ok(limiter.size() <= 50);
  });
});
