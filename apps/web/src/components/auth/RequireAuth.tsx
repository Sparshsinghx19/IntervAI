'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { SessionExpiredDialog } from './SessionExpiredDialog';
import { buildAuthHref } from '@/lib/safe-redirect';

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-obsidian text-foreground flex flex-col items-center justify-center gap-4 px-4 text-center">
      {children}
    </div>
  );
}

/**
 * Client-side gate for signed-in pages. It only improves the UX: the API
 * enforces authentication and ownership on every request regardless.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, sessionExpired, restore } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(buildAuthHref('/login', `${pathname}${window.location.search}`));
    }
  }, [status, pathname, router]);

  if (status === 'authenticated') {
    return (
      <>
        {children}
        {sessionExpired && <SessionExpiredDialog />}
      </>
    );
  }

  if (status === 'error') {
    return (
      <FullScreenMessage>
        <p className="text-sm text-slate-300" role="alert">
          We couldn&apos;t check your sign-in. Make sure the server is running, then try again.
        </p>
        <button
          type="button"
          onClick={() => void restore()}
          className="inline-flex h-10 items-center rounded-full border border-white/10 px-5 text-sm font-medium text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          Try again
        </button>
      </FullScreenMessage>
    );
  }

  return (
    <FullScreenMessage>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" aria-hidden="true" />
      <span className="sr-only" role="status">Checking your session…</span>
    </FullScreenMessage>
  );
}
