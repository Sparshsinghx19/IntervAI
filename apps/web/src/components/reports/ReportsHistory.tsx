'use client';

import { useCallback, useEffect, useState } from 'react';
import { Navbar } from '@/components/marketing/navbar';
import { fetchInterviewHistory, HistoryState } from '@/lib/history-api';
import { ReportHistoryView, StartInterviewLink } from './ReportHistoryView';

export function ReportsHistory() {
  const [state, setState] = useState<HistoryState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchInterviewHistory());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchInterviewHistory().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-obsidian text-foreground selection:bg-brand-500/30">
      <Navbar mode="app" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-glow-gradient opacity-70" />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 border-b border-white/[0.07] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-300/80">Interview history</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">My Interview Reports</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
              Review how your previous interviews went: overall scores, per-question feedback, model answers and what to
              practise next.
            </p>
          </div>
          <StartInterviewLink />
        </header>

        <section aria-label="Recent reports" className="mt-8">
          <ReportHistoryView state={state} onRetry={load} />
          {state.status === 'ready' && state.reports.length > 0 && (
            <p className="mt-6 text-center text-xs text-slate-400">
              {state.reports.length === 1
                ? 'Showing your completed report.'
                : `Showing your ${state.reports.length} most recent completed reports.`}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
