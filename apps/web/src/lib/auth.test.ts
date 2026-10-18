import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { apiFetch, onSessionExpired } from './api-client';
import { fetchCurrentUser, loginUser, logoutUser, registerUser, AuthResult, CurrentUserResult } from './auth-api';
import { createAuthStore, AuthApi } from './auth-store';
import { submitAuthForm, validateSignupForm } from './auth-form';
import { buildAuthHref, getSafeRedirect } from './safe-redirect';
import { AuthField } from '../components/auth/AuthField';

type Call = { url: string; init?: RequestInit };

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const recordingFetch = (response: Response | (() => Promise<Response>)) => {
  const calls: Call[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return typeof response === 'function' ? response() : response;
  }) as unknown as typeof fetch;
  return { fn, calls };
};

const USER = { id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'USER' as const };

describe('Auth API client', () => {
  beforeEach(() => mock.restoreAll());

  it('logs in with credentials included and returns only public user fields', async () => {
    const { fn, calls } = recordingFetch(jsonResponse(200, { user: { ...USER, passwordHash: 'leak', token: 'leak' } }));
    const result = await loginUser({ email: 'ada@example.com', password: 'pw' }, { fetchFn: fn, apiUrl: 'http://api' });

    assert.deepEqual(result, { ok: true, user: USER });
    assert.equal(calls[0].url, 'http://api/api/auth/login');
    assert.equal(calls[0].init?.method, 'POST');
    assert.equal(calls[0].init?.credentials, 'include');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { email: 'ada@example.com', password: 'pw' });
  });

  it('maps a wrong password to the generic invalid-credentials message', async () => {
    const { fn } = recordingFetch(jsonResponse(401, { error: 'whatever the server said' }));
    const result = await loginUser({ email: 'a@b.co', password: 'x' }, { fetchFn: fn });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error, 'Invalid email or password.');
  });

  it('returns safe messages for rate limits, server errors and network failures', async () => {
    const limited = await loginUser({ email: 'a@b.co', password: 'x' }, { fetchFn: recordingFetch(jsonResponse(429, {})).fn });
    assert.match(!limited.ok ? limited.error : '', /Too many attempts/);

    const crashed = await loginUser(
      { email: 'a@b.co', password: 'x' },
      { fetchFn: recordingFetch(jsonResponse(500, { error: 'SqlQueryError: duplicate key (email)=(a@b.co)' })).fn }
    );
    assert.equal(!crashed.ok && crashed.error, 'Something went wrong. Please try again.');

    const offline = await loginUser(
      { email: 'a@b.co', password: 'x' },
      { fetchFn: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch }
    );
    assert.equal(!offline.ok && offline.status, 0);
    assert.match(!offline.ok ? offline.error : '', /Could not reach the server/);
  });

  it('passes through server field errors and duplicate-email conflicts on sign up', async () => {
    const invalid = await registerUser(
      { name: '', email: 'x', password: 'y' },
      { fetchFn: recordingFetch(jsonResponse(400, { error: 'Fix fields', fieldErrors: { email: 'Enter a valid email address.', other: 'ignored' } })).fn }
    );
    assert.deepEqual(!invalid.ok && invalid.fieldErrors, { email: 'Enter a valid email address.' });

    const taken = await registerUser(
      { name: 'A', email: 'a@b.co', password: 'password1' },
      { fetchFn: recordingFetch(jsonResponse(409, { error: 'An account with this email already exists. Try logging in instead.' })).fn }
    );
    assert.equal(!taken.ok && taken.status, 409);
    assert.match(!taken.ok ? taken.error : '', /already exists/);
  });

  it('restores the current user from /me and treats 401 as signed out', async () => {
    const ok = recordingFetch(jsonResponse(200, { user: USER }));
    assert.deepEqual(await fetchCurrentUser({ fetchFn: ok.fn }), { status: 'authenticated', user: USER });
    assert.equal(ok.calls[0].init?.credentials, 'include');

    assert.deepEqual(await fetchCurrentUser({ fetchFn: recordingFetch(jsonResponse(401, {})).fn }), { status: 'unauthenticated' });
    const down = await fetchCurrentUser({ fetchFn: (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch });
    assert.equal(down.status, 'error');
  });

  it('logs out with a credentialed POST', async () => {
    const { fn, calls } = recordingFetch({ ok: true, status: 204 } as Response);
    assert.deepEqual(await logoutUser({ fetchFn: fn, apiUrl: 'http://api' }), { ok: true });
    assert.equal(calls[0].url, 'http://api/api/auth/logout');
    assert.equal(calls[0].init?.method, 'POST');
    assert.equal(calls[0].init?.credentials, 'include');
  });

  it('apiFetch always sends cookies and reports 401 responses', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => jsonResponse(401, {}));
    let expired = 0;
    const unsubscribe = onSessionExpired(() => { expired++; });

    await apiFetch('http://api/api/interviews', { method: 'POST' });
    const init = fetchMock.mock.calls[0].arguments[1] as RequestInit;
    assert.equal(init.credentials, 'include');
    assert.equal(init.method, 'POST');
    assert.equal(expired, 1);

    unsubscribe();
    await apiFetch('http://api/api/interviews');
    assert.equal(expired, 1);
  });
});

describe('Auth store', () => {
  const fakeApi = (overrides: Partial<AuthApi> = {}) => {
    const calls: string[] = [];
    const api: AuthApi = {
      fetchCurrentUser: async (): Promise<CurrentUserResult> => { calls.push('me'); return { status: 'unauthenticated' }; },
      loginUser: async (): Promise<AuthResult> => { calls.push('login'); return { ok: true, user: USER }; },
      registerUser: async (): Promise<AuthResult> => { calls.push('register'); return { ok: true, user: USER }; },
      logoutUser: async () => { calls.push('logout'); return { ok: true }; },
      ...overrides,
    };
    return { api, calls };
  };

  it('starts loading and restores a signed-in user from the session cookie', async () => {
    const store = createAuthStore(fakeApi({ fetchCurrentUser: async () => ({ status: 'authenticated', user: USER }) }).api);
    assert.equal(store.getState().status, 'loading');
    await store.restore();
    assert.deepEqual(store.getState(), { status: 'authenticated', user: USER, sessionExpired: false });
  });

  it('becomes unauthenticated when there is no session, and error when the API is unreachable', async () => {
    const anon = createAuthStore(fakeApi().api);
    await anon.restore();
    assert.equal(anon.getState().status, 'unauthenticated');

    const down = createAuthStore(fakeApi({ fetchCurrentUser: async () => ({ status: 'error', error: 'x' }) }).api);
    await down.restore();
    assert.equal(down.getState().status, 'error');
  });

  it('signs in on successful login and stays signed out on failure', async () => {
    const store = createAuthStore(fakeApi({
      loginUser: async () => ({ ok: false, status: 401, error: 'Invalid email or password.' }),
    }).api);
    await store.restore();
    const failed = await store.login({ email: 'a@b.co', password: 'x' });
    assert.equal(failed.ok, false);
    assert.equal(store.getState().status, 'unauthenticated');

    const ok = createAuthStore(fakeApi().api);
    const seen: string[] = [];
    ok.subscribe(() => seen.push(ok.getState().status));
    await ok.login({ email: 'a@b.co', password: 'x' });
    assert.deepEqual(ok.getState().user, USER);
    assert.deepEqual(seen, ['authenticated']);
  });

  it('logout clears the user even if the request fails', async () => {
    const { api, calls } = fakeApi({ logoutUser: async () => ({ ok: false }) });
    const store = createAuthStore(api);
    await store.login({ email: 'a@b.co', password: 'x' });
    await store.logout();
    assert.ok(calls.includes('login'));
    assert.deepEqual(store.getState(), { status: 'unauthenticated', user: null, sessionExpired: false });
  });

  it('keeps the page mounted when the session expires, until the user logs in again', async () => {
    let meResult: CurrentUserResult = { status: 'unauthenticated' };
    const store = createAuthStore(fakeApi({ fetchCurrentUser: async () => meResult }).api);
    await store.login({ email: 'a@b.co', password: 'x' });

    store.markSessionExpired();
    assert.equal(store.getState().status, 'authenticated', 'page is not torn down');
    assert.equal(store.getState().sessionExpired, true);

    await store.restore(); // still signed out
    assert.equal(store.getState().status, 'authenticated');
    assert.equal(store.getState().sessionExpired, true);

    meResult = { status: 'authenticated', user: USER }; // logged in again in another tab
    await store.restore();
    assert.equal(store.getState().sessionExpired, false);
  });

  it('ignores expiry signals when nobody is signed in', async () => {
    const store = createAuthStore(fakeApi().api);
    await store.restore();
    store.markSessionExpired();
    assert.equal(store.getState().sessionExpired, false);
  });
});

describe('Safe redirects', () => {
  it('keeps same-site paths with their query string', () => {
    assert.equal(getSafeRedirect('/interview/session?id=abc'), '/interview/session?id=abc');
    assert.equal(getSafeRedirect('/interview'), '/interview');
  });

  it('falls back to the dashboard for anything that could leave the site or loop to an auth page', () => {
    for (const bad of [
      'https://evil.com', '//evil.com', '/\\evil.com', '\\\\evil.com', 'javascript:alert(1)',
      'evil.com', '/%0d%0aLocation:x', '/login', '/signup?next=/x', '', null, undefined, '/a\nb',
    ]) {
      assert.equal(getSafeRedirect(bad as string), '/dashboard', String(bad));
    }
  });

  it('builds auth links that preserve a safe return path', () => {
    assert.equal(buildAuthHref('/login', '/interview/session?id=1'), '/login?next=%2Finterview%2Fsession%3Fid%3D1');
    assert.equal(buildAuthHref('/signup', 'https://evil.com'), '/signup');
    // The default destination needs no parameter; any other safe path is preserved.
    assert.equal(buildAuthHref('/login', '/dashboard'), '/login');
    assert.equal(buildAuthHref('/login', '/interview'), '/login?next=%2Finterview');
  });
});

describe('Login and sign-up form submission', () => {
  const actions = (result: AuthResult) => {
    const calls: unknown[] = [];
    return {
      calls,
      login: async (input: unknown) => { calls.push(['login', input]); return result; },
      register: async (input: unknown) => { calls.push(['register', input]); return result; },
    };
  };
  const values = { name: ' Ada ', email: ' ada@example.com ', password: 'password123' };

  it('validates locally without calling the API or entering the loading state', async () => {
    const a = actions({ ok: true, user: USER });
    const loading: boolean[] = [];
    const outcome = await submitAuthForm('signup', { name: '', email: 'bad', password: 'short' }, a, (s) => loading.push(s));
    assert.equal(outcome.ok, false);
    assert.equal(outcome.focus, 'name');
    assert.ok(outcome.fieldErrors.email && outcome.fieldErrors.password);
    assert.deepEqual(a.calls, []);
    assert.deepEqual(loading, []);
  });

  it('submits trimmed values and stays in the loading state on success', async () => {
    const a = actions({ ok: true, user: USER });
    const loading: boolean[] = [];
    const outcome = await submitAuthForm('signup', values, a, (s) => loading.push(s));
    assert.equal(outcome.ok, true);
    assert.deepEqual(a.calls, [['register', { name: 'Ada', email: 'ada@example.com', password: 'password123' }]]);
    assert.deepEqual(loading, [true]);
  });

  it('shows the generic error, clears the password and leaves loading on a failed login', async () => {
    const a = actions({ ok: false, status: 401, error: 'Invalid email or password.' });
    const loading: boolean[] = [];
    const outcome = await submitAuthForm('login', values, a, (s) => loading.push(s));
    assert.deepEqual(loading, [true, false]);
    assert.equal(outcome.formError, 'Invalid email or password.');
    assert.equal(outcome.clearPassword, true);
    assert.equal(outcome.focus, 'password');
  });

  it('puts a duplicate-email conflict on the email field', async () => {
    const a = actions({ ok: false, status: 409, error: 'An account with this email already exists.' });
    const outcome = await submitAuthForm('signup', values, a, () => undefined);
    assert.equal(outcome.fieldErrors.email, 'An account with this email already exists.');
    assert.equal(outcome.focus, 'email');
    assert.equal(outcome.formError, '');
  });

  it('shows network errors as a form-level alert', async () => {
    const a = actions({ ok: false, status: 0, error: 'Could not reach the server. Check your connection and try again.' });
    const outcome = await submitAuthForm('login', values, a, () => undefined);
    assert.equal(outcome.focus, 'form');
    assert.match(outcome.formError, /Could not reach the server/);
  });

  it('mirrors the server password rules', () => {
    assert.ok(validateSignupForm({ name: 'A', email: 'a@b.co', password: '1234567' }).password);
    assert.ok(validateSignupForm({ name: 'A', email: 'a@b.co', password: '        ' }).password);
    assert.deepEqual(validateSignupForm({ name: 'A', email: 'a@b.co', password: '12345678' }), {});
  });
});

describe('AuthField rendering', () => {
  it('links the label, error message and password visibility toggle accessibly', () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthField, {
        id: 'password', label: 'Password', type: 'password', value: '', onChange: () => undefined,
        autoComplete: 'current-password', error: 'Password is required.',
      })
    );
    assert.match(html, /<label for="password"/);
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /aria-describedby="password-error"/);
    assert.match(html, /id="password-error"[\s\S]*Password is required\./);
    assert.match(html, /type="password"/);
    assert.match(html, /aria-label="Show password"/);
    assert.match(html, /aria-pressed="false"/);
  });
});
