import { API_URL } from './api-client';

export type UserRole = 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type AuthFieldErrors = Partial<Record<'name' | 'email' | 'password', string>>;

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; status: number; error: string; fieldErrors?: AuthFieldErrors };

export type CurrentUserResult =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: string };

type FetchFn = typeof fetch;

const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

const KNOWN_FIELDS = ['name', 'email', 'password'] as const;

function pickFieldErrors(raw: unknown): AuthFieldErrors | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: AuthFieldErrors = {};
  for (const field of KNOWN_FIELDS) {
    const value = (raw as Record<string, unknown>)[field];
    if (typeof value === 'string' && value.length <= 200) out[field] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function pickUser(raw: unknown): AuthUser | null {
  const u = (raw as { user?: Record<string, unknown> } | null)?.user;
  if (!u || typeof u.id !== 'string' || typeof u.email !== 'string') return null;
  // Copy only the known public fields; ignore anything else the server sends.
  return {
    id: u.id,
    name: typeof u.name === 'string' ? u.name : '',
    email: u.email,
    role: u.role === 'ADMIN' ? 'ADMIN' : 'USER',
  };
}

/** Maps an error response to a message that is safe to show (no raw server internals). */
function toSafeError(status: number, body: unknown, fallbackFor401: string): string {
  if (status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  if (status === 401) return fallbackFor401;
  if (status === 403) return 'This request was blocked. Reload the page and try again.';
  if (status >= 500) return GENERIC_ERROR;
  const message = (body as { error?: unknown } | null)?.error;
  return typeof message === 'string' && message.length <= 200 ? message : GENERIC_ERROR;
}

async function postAuth(
  path: string,
  payload: Record<string, string>,
  fetchFn: FetchFn,
  apiUrl: string,
  fallbackFor401: string
): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetchFn(`${apiUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }

  const body = await res.json().catch(() => null);
  if (res.ok) {
    const user = pickUser(body);
    return user ? { ok: true, user } : { ok: false, status: res.status, error: GENERIC_ERROR };
  }
  return {
    ok: false,
    status: res.status,
    error: toSafeError(res.status, body, fallbackFor401),
    fieldErrors: res.status === 400 ? pickFieldErrors((body as { fieldErrors?: unknown } | null)?.fieldErrors) : undefined,
  };
}

export function registerUser(
  input: { name: string; email: string; password: string },
  { fetchFn = fetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<AuthResult> {
  return postAuth('/api/auth/register', input, fetchFn, apiUrl, 'Please log in to continue.');
}

export function loginUser(
  input: { email: string; password: string },
  { fetchFn = fetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<AuthResult> {
  return postAuth('/api/auth/login', input, fetchFn, apiUrl, 'Invalid email or password.');
}

export async function logoutUser(
  { fetchFn = fetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<{ ok: boolean }> {
  try {
    const res = await fetchFn(`${apiUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function fetchCurrentUser(
  { fetchFn = fetch, apiUrl = API_URL }: { fetchFn?: FetchFn; apiUrl?: string } = {}
): Promise<CurrentUserResult> {
  try {
    const res = await fetchFn(`${apiUrl}/api/auth/me`, { credentials: 'include', cache: 'no-store' });
    if (res.status === 401) return { status: 'unauthenticated' };
    if (!res.ok) return { status: 'error', error: GENERIC_ERROR };
    const user = pickUser(await res.json().catch(() => null));
    return user ? { status: 'authenticated', user } : { status: 'error', error: GENERIC_ERROR };
  } catch {
    return { status: 'error', error: NETWORK_ERROR };
  }
}
