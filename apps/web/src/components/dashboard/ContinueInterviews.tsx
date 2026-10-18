import Link from 'next/link';
import { AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InProgressInterview, InProgressState, resumeHref } from '@/lib/dashboard-api';
import { formatCompletedDate, formatDifficulty, formatFocusArea, formatInterviewType } from '@/lib/history-api';

const SURFACE = 'rounded-xl border border-white/[0.07] bg-white/[0.02]';

function ProgressBar({ answered, total }: { answered: number; total: number }) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={answered}
      aria-label={`${answered} of ${total} questions answered`}
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
    >
      <div className="h-full rounded-full bg-cyan-400/80" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ContinueRow({ item }: { item: InProgressInterview }) {
  const title = formatFocusArea(item.focusArea);
  const meta = [formatInterviewType(item.type), formatDifficulty(item.difficulty)].filter(Boolean).join(' · ');
  const answered = `${item.answeredCount} of ${item.questionCount} answered`;

  return (
    <li className="grid grid-cols-1 gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_11rem_auto] md:items-center md:gap-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {meta}
          {item.lastActivityAt && (
            <>
              {meta ? ' · ' : ''}Last active <time dateTime={item.lastActivityAt}>{formatCompletedDate(item.lastActivityAt)}</time>
            </>
          )}
        </p>
      </div>
      <div>
        <p className="mb-1.5 text-xs text-slate-300 tabular-nums">{answered}</p>
        <ProgressBar answered={item.answeredCount} total={item.questionCount} />
      </div>
      <Link
        href={resumeHref(item.interviewId)}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 text-sm font-medium text-white transition-colors hover:border-brand-400/40 hover:bg-brand-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none"
      >
        Continue Interview
        <span className="sr-only">: {title}, {answered}</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * Unfinished interviews the candidate can pick up again. Renders nothing when
 * there is nothing to resume, so the dashboard stays focused.
 */
export function ContinueInterviews({ state, onRetry }: { state: InProgressState; onRetry: () => void }) {
  if (state.status === 'ready' && state.interviews.length === 0) return null;

  return (
    <section aria-labelledby="continue-heading">
      <h2 id="continue-heading" className="mb-3 text-base font-semibold text-white">
        Continue where you left off
      </h2>

      {state.status === 'loading' && (
        <div role="status" className={cn(SURFACE, 'flex items-center gap-4 px-5 py-4')}>
          <span className="sr-only">Checking for unfinished interviews…</span>
          <div aria-hidden="true" className="flex-1 space-y-2">
            <div className="h-3.5 w-40 rounded bg-white/[0.06] motion-safe:animate-pulse" />
            <div className="h-3 w-56 rounded bg-white/[0.04] motion-safe:animate-pulse" />
          </div>
          <div aria-hidden="true" className="hidden h-9 w-40 rounded-lg bg-white/[0.05] motion-safe:animate-pulse sm:block" />
        </div>
      )}

      {state.status === 'error' && (
        <div className={cn(SURFACE, 'flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center')}>
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <p role="alert" className="flex-1 text-sm text-slate-300">
            {state.message}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm font-medium text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <ul className={cn(SURFACE, 'divide-y divide-white/[0.06]')}>
          {state.interviews.map((item) => (
            <ContinueRow key={item.interviewId} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
