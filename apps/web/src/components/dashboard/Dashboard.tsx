'use client';

import { useCallback, useEffect, useState } from 'react';
import { Navbar } from '@/components/marketing/navbar';
import { useAuth } from '@/components/auth/AuthProvider';
import { DashboardState, fetchInProgressInterviews, InProgressState, loadDashboard } from '@/lib/dashboard-api';
import { DashboardBody, DashboardHeader } from './DashboardView';
import { ContinueInterviews } from './ContinueInterviews';

export function Dashboard() {
  const { user } = useAuth();
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const [inProgress, setInProgress] = useState<InProgressState>({ status: 'loading' });

  const retry = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await loadDashboard());
  }, []);

  const retryInProgress = useCallback(async () => {
    setInProgress({ status: 'loading' });
    setInProgress(await fetchInProgressInterviews());
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Loaded independently: a failure in one section never blanks the other.
    loadDashboard().then((result) => {
      if (!cancelled) setState(result);
    });
    fetchInProgressInterviews().then((result) => {
      if (!cancelled) setInProgress(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-obsidian text-foreground selection:bg-brand-500/30">
      <Navbar mode="app" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <DashboardHeader name={user?.name} state={state} />
        <div className="mt-8 space-y-8">
          <ContinueInterviews state={inProgress} onRetry={retryInProgress} />
          <DashboardBody state={state} onRetry={retry} />
        </div>
      </main>
    </div>
  );
}
