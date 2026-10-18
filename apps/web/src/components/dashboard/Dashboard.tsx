'use client';

import { useCallback, useEffect, useState } from 'react';
import { Navbar } from '@/components/marketing/navbar';
import { useAuth } from '@/components/auth/AuthProvider';
import { DashboardState, loadDashboard } from '@/lib/dashboard-api';
import { DashboardBody, DashboardHeader } from './DashboardView';

export function Dashboard() {
  const { user } = useAuth();
  const [state, setState] = useState<DashboardState>({ status: 'loading' });

  const retry = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await loadDashboard());
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadDashboard().then((result) => {
      if (!cancelled) setState(result);
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
        <div className="mt-8">
          <DashboardBody state={state} onRetry={retry} />
        </div>
      </main>
    </div>
  );
}
