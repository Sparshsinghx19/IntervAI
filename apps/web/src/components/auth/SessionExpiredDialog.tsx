'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2, LockKeyhole } from 'lucide-react';
import { authStore } from '@/lib/auth-store';
import { buildAuthHref } from '@/lib/safe-redirect';

/**
 * Shown over the current page when the API reports an expired session. The page
 * stays mounted, so an unsaved answer or code draft is not lost: the user logs
 * in again in a new tab, then continues here.
 */
export function SessionExpiredDialog() {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const [checking, setChecking] = useState(false);
  const [stillSignedOut, setStillSignedOut] = useState(false);
  // Only ever rendered in the browser, after an API call failed.
  const [returnPath] = useState(() =>
    typeof window === 'undefined' ? pathname : `${pathname}${window.location.search}`
  );

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  // Keep keyboard focus inside the dialog while it is open.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleContinue = async () => {
    setChecking(true);
    setStillSignedOut(false);
    const result = await authStore.restore();
    setChecking(false);
    if (result.status !== 'authenticated') setStillSignedOut(true);
  };

  const loginHref = buildAuthHref('/login', returnPath);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-obsidian/80 px-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        aria-describedby="session-expired-description"
        onKeyDown={onKeyDown}
        className="glass-card-strong w-full max-w-md rounded-2xl p-6 shadow-glow"
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/10">
          <LockKeyhole className="h-5 w-5 text-brand-300" aria-hidden="true" />
        </div>
        <h2 id="session-expired-title" className="text-lg font-semibold text-white">
          Your session has expired
        </h2>
        <p id="session-expired-description" className="mt-2 text-sm leading-relaxed text-slate-400">
          Log in again in a new tab, then come back and continue. Anything you have typed on this page stays here.
        </p>

        {stillSignedOut && (
          <p role="status" className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
            You are still signed out. Log in in the other tab first, then press Continue.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <a
            ref={primaryRef}
            href={loginHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-cyan-600 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
          >
            Log in in a new tab
          </a>
          <button
            type="button"
            onClick={handleContinue}
            disabled={checking}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
          >
            {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {checking ? 'Checking…' : 'Continue'}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Or{' '}
          <a href={loginHref} className="text-brand-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
            log in on this tab
          </a>{' '}
          (unsaved work on this page will be lost).
        </p>
      </div>
    </div>
  );
}
