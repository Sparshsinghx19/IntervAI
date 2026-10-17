export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
