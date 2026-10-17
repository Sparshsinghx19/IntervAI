'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Clock, FileQuestion, RotateCcw } from 'lucide-react';
import { Navbar } from '@/components/marketing/navbar';
import { EvaluationReportView } from '@/components/interview/EvaluationReportView';
import { loadSavedReport, ReportDetailState } from '@/lib/history-api';
import { StartInterviewLink } from './ReportHistoryView';

const UNAVAILABLE_COPY = {
  missing: {
    icon: FileQuestion,
    title: 'Report not available',
    body: "We couldn't find a saved report for this interview in your account.",
  },
  pending: {
    icon: Clock,
    title: 'Report still being prepared',
    body: 'This interview’s report has not finished generating yet. Check back in a moment.',
  },
  failed: {
    icon: AlertTriangle,
    title: 'Report generation did not finish',
    body: 'Your answers are saved, but the report could not be generated. You can retry from the interview session.',
  },
} as const;

/** Shown instead of a report; it never starts report generation on its own. */
export function ReportUnavailable({
  state,
  interviewId,
  onRetry,
}: {
  state: Extract<ReportDetailState, { status: 'unavailable' | 'error' }>;
  interviewId: string;
  onRetry: () => void;
}) {
  const copy =
    state.status === 'error'
      ? { icon: AlertTriangle, title: 'Couldn’t load this report', body: state.message }
      : UNAVAILABLE_COPY[state.reason];
  const Icon = copy.icon;

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-12 text-center sm:px-10">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <Icon className="h-5 w-5 text-brand-300" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-white">{copy.title}</h1>
      <p role={state.status === 'error' ? 'alert' : undefined} className="mt-2 text-sm leading-relaxed text-slate-400">
        {copy.body}
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {state.status === 'error' && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        )}
        {state.status === 'unavailable' && state.reason === 'failed' && (
          <Link
            href={`/interview/session?id=${encodeURIComponent(interviewId)}`}
            className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-medium text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            Open interview session
          </Link>
        )}
        <Link
          href="/reports"
          className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-medium text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          Back to My Reports
        </Link>
      </div>
    </div>
  );
}

/** Reopens a saved report read-only. Only GETs the stored report; no AI calls. */
export function ReportDetail({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ReportDetailState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await loadSavedReport(interviewId));
  }, [interviewId]);

  useEffect(() => {
    let cancelled = false;
    loadSavedReport(interviewId).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  return (
    <div className="relative min-h-screen bg-obsidian text-foreground selection:bg-brand-500/30">
      <Navbar mode="app" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-glow-gradient opacity-60" />

      <div className="relative z-10 pt-20">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 pt-4 sm:px-8">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            My Reports
          </Link>
          {state.status === 'ready' && <StartInterviewLink />}
        </div>

        {state.status === 'loading' && (
          <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-slate-400">
            <div className="h-8 w-8 rounded-full border-b-2 border-brand-500 motion-safe:animate-spin" aria-hidden="true" />
            Loading your report…
          </div>
        )}

        {state.status === 'ready' && (
          <EvaluationReportView
            report={state.report}
            isLoading={false}
            // Only completed reports reach this view, so its retry path is never shown; reloading is a plain GET.
            onRetry={load}
            onReturnToSetup={() => router.push('/interview')}
          />
        )}

        {(state.status === 'unavailable' || state.status === 'error') && (
          <div className="px-4">
            <ReportUnavailable state={state} interviewId={interviewId} onRetry={load} />
          </div>
        )}
      </div>
    </div>
  );
}
