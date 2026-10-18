/**
 * Base URL of the API. "same-origin" (production) sends requests to this site's
 * own /api path, which the Next.js server proxies to the API (see next.config.ts),
 * so the session cookie stays first-party. Unset in local development.
 */
export function resolveApiUrl(configured: string | undefined): string {
  const value = configured?.trim();
  if (!value) return 'http://localhost:4000';
  if (value === 'same-origin') return '';
  return value.replace(/\/+$/, '');
}

export const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Subscribes to "an authenticated API call came back 401". Returns an unsubscribe function. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export function notifySessionExpired(): void {
  for (const listener of [...sessionExpiredListeners]) listener();
}

/**
 * fetch() for the IntervAI API: always sends the HttpOnly session cookie
 * (the API is on a different origin) and reports 401s so the UI can ask the
 * user to log in again without throwing away what is on screen.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'include' });
  if (res.status === 401) notifySessionExpired();
  return res;
}
