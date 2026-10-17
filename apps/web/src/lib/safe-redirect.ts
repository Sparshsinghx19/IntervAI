export const DEFAULT_AFTER_LOGIN = '/interview';

const AUTH_PAGES = new Set(['/login', '/signup']);
const PLACEHOLDER_ORIGIN = 'http://intervai.local';

/**
 * Returns `raw` only if it is a same-site relative path (e.g. "/interview/session?id=…").
 * Anything that could leave the site ("//evil.com", "/\\evil.com", "https://…",
 * "javascript:…") or would loop back to an auth page falls back to `fallback`.
 */
export function getSafeRedirect(raw: string | null | undefined, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (!raw || typeof raw !== 'string' || raw.length > 2048) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  try {
    // Also refuse percent-encoded control characters (e.g. "%0d%0a").
    if (/[\u0000-\u001f\u007f]/.test(decodeURIComponent(raw))) return fallback;
  } catch {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  if (AUTH_PAGES.has(url.pathname)) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}

/** Link to an auth page that carries a safe "return to" path. */
export function buildAuthHref(page: '/login' | '/signup', next?: string | null): string {
  const safe = getSafeRedirect(next, '');
  return safe && safe !== DEFAULT_AFTER_LOGIN ? `${page}?next=${encodeURIComponent(safe)}` : page;
}
