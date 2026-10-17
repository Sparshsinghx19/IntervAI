import Link from 'next/link';
import { AlertTriangle, ArrowRight, CalendarClock, FileText, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatCompletedDate,
  formatDifficulty,
  formatFocusArea,
  formatInterviewType,
  HistoryState,
  InterviewHistoryItem,
  scoreTone,
  ScoreTone,
} from '@/lib/history-api';

const TONE_STYLES: Record<ScoreTone, string> = {
  excellent: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10',
  strong: 'text-cyan-300 border-cyan-400/30 bg-cyan-500/10',
  steady: 'text-brand-300 border-brand-400/30 bg-brand-500/10',
  developing: 'text-amber-300 border-amber-400/30 bg-amber-500/10',
  none: 'text-slate-300 border-white/10 bg-white/[0.04]',
};

const primaryAction =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-obsidian transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian motion-reduce:transition-none';

export function StartInterviewLink({ label = 'Start new interview' }: { label?: string }) {
  return (
    <Link href="/interview" className={primaryAction}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  return (
    <div
      className={cn(
        'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border',
        TONE_STYLES[scoreTone(score)]
      )}
    >
      {score === null ? (
        <span className="text-xs font-medium">N/A</span>
      ) : (
        <>
          <span className="text-lg font-semibold leading-none tabular-nums">{score}</span>
          <span className="mt-0.5 text-[10px] leading-none opacity-80">/ 100</span>
        </>
      )}
    </div>
  );
}

function ReportCard({ item }: { item: InterviewHistoryItem }) {
  const title = formatFocusArea(item.focusArea);
  const meta = [
    formatInterviewType(item.type),
    formatDifficulty(item.difficulty),
    item.questionCount ? `${item.questionCount} questions` : null,
  ].filter(Boolean);

  return (
    <li>
      <article
        aria-labelledby={`report-${item.interviewId}`}
        className="group flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors hover:border-brand-400/25 hover:bg-white/[0.03] motion-reduce:transition-none sm:flex-row sm:items-center sm:gap-5"
      >
        <div className="flex items-start gap-4 sm:flex-1 sm:items-center">
          <ScoreBadge score={item.overallScore} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id={`report-${item.interviewId}`} className="text-base font-semibold text-white">
                {title}
              </h2>
              {item.performanceLevel && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-slate-300">
                  {item.performanceLevel}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-400">{meta.join(' · ')}</p>
            {item.summary && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-300">{item.summary}</p>}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Completed <time dateTime={item.completedAt}>{formatCompletedDate(item.completedAt)}</time>
              </span>
            </p>
          </div>
        </div>
        <Link
          href={`/reports/${item.interviewId}`}
          aria-label={`View report: ${title}, completed ${formatCompletedDate(item.completedAt)}`}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 text-sm font-medium text-white transition-colors hover:border-brand-400/40 hover:bg-brand-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none"
        >
          View report
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </Link>
      </article>
    </li>
  );
}

function LoadingList() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading your reports…</span>
      <ul className="space-y-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="h-14 w-14 rounded-2xl bg-white/[0.05] motion-safe:animate-pulse" />
            <div className="flex-1 space-y-2.5">
              <div className="h-4 w-1/3 rounded bg-white/[0.06] motion-safe:animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-white/[0.04] motion-safe:animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-white/[0.04] motion-safe:animate-pulse" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-6 py-12 text-center sm:px-10',
        tone === 'warning' ? 'border-amber-400/20 bg-amber-500/[0.04]' : 'border-white/[0.07] bg-white/[0.02]'
      )}
    >
      {children}
    </div>
  );
}

/** Presentational list for "My Reports": loading, error, empty and populated states. */
export function ReportHistoryView({ state, onRetry }: { state: HistoryState; onRetry: () => void }) {
  if (state.status === 'loading') return <LoadingList />;

  if (state.status === 'error') {
    return (
      <Panel tone="warning">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-300" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold text-white">Couldn&apos;t load your reports</h2>
        <p role="alert" className="mx-auto mt-2 max-w-md text-sm text-slate-300">
          {state.message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </Panel>
    );
  }

  if (state.reports.length === 0) {
    return (
      <Panel>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-400/25 bg-brand-500/10">
          <FileText className="h-5 w-5 text-brand-300" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-white">No reports yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
          Finish an interview and its scored report will be saved here, so you can come back to the feedback and model
          answers any time.
        </p>
        <div className="mt-6 flex justify-center">
          <StartInterviewLink label="Start your first interview" />
        </div>
      </Panel>
    );
  }

  return (
    <ul className="space-y-3" aria-label="Completed interview reports">
      {state.reports.map((item) => (
        <ReportCard key={item.interviewId} item={item} />
      ))}
    </ul>
  );
}
