import Link from 'next/link';
import { AlertTriangle, ArrowRight, ChevronRight, ClipboardList, Code2, LineChart, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardState, DashboardSummary, firstName, formatScore } from '@/lib/dashboard-api';
import {
  formatDifficulty,
  formatFocusArea,
  formatInterviewType,
  InterviewHistoryItem,
  scoreTone,
  ScoreTone,
} from '@/lib/history-api';

// ---------- Shared building blocks ----------

const SURFACE = 'rounded-xl border border-white/[0.07] bg-white/[0.02]';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian';

const SCORE_TEXT: Record<ScoreTone, string> = {
  excellent: 'text-emerald-300',
  strong: 'text-cyan-300',
  steady: 'text-brand-300',
  developing: 'text-amber-300',
  none: 'text-slate-400',
};

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function StartInterviewButton({ label = 'Start New Interview', className }: { label?: string; className?: string }) {
  return (
    <Link
      href="/interview"
      className={cn(
        'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-obsidian transition-colors hover:bg-brand-100 motion-reduce:transition-none',
        FOCUS_RING,
        className
      )}
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

// ---------- Header ----------

function subtitleFor(state: DashboardState): string {
  if (state.status !== 'ready') return 'Your interview practice at a glance.';
  const { completedInterviews, lastCompletedAt } = state.summary;
  if (completedInterviews === 0) return 'Set up your first mock interview to get a scored, question-by-question report.';
  const noun = completedInterviews === 1 ? 'interview' : 'interviews';
  const last = lastCompletedAt ? ` Your latest report is from ${formatDay(lastCompletedAt)}.` : '';
  return `You have completed ${completedInterviews} ${noun}.${last}`;
}

export function DashboardHeader({ name, state }: { name: string | null | undefined; state: DashboardState }) {
  const first = firstName(name);
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-white sm:text-[1.75rem]">
          {first ? `Welcome, ${first}` : 'Welcome'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">{subtitleFor(state)}</p>
      </div>
      <StartInterviewButton />
    </header>
  );
}

// ---------- Metrics ----------

/**
 * Phones: a compact row (label and context left, value right) inside one list.
 * Larger screens: a card per metric.
 */
const METRIC_ITEM =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 sm:block sm:rounded-xl sm:border sm:border-white/[0.07] sm:bg-white/[0.02] sm:px-5 sm:py-4';
const METRIC_LIST =
  'divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] sm:grid sm:grid-cols-3 sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent';

function Metric({ label, value, suffix, context }: { label: string; value: React.ReactNode; suffix?: string; context: React.ReactNode }) {
  return (
    <div className={METRIC_ITEM}>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="row-span-2 flex items-baseline justify-end gap-1 sm:mt-2 sm:justify-start">
        <span className="text-xl font-semibold leading-none tracking-tight text-white tabular-nums sm:text-[1.75rem]">{value}</span>
        {suffix && <span className="text-xs text-slate-500 sm:text-sm">{suffix}</span>}
      </dd>
      <dd className="mt-1 text-xs text-slate-400 sm:mt-2 sm:min-h-[1.25rem] sm:truncate">{context}</dd>
    </div>
  );
}

export function MetricsOverview({ summary }: { summary: DashboardSummary }) {
  const { completedInterviews, scoredReports, averageScore, bestScore, bestReport, lastCompletedAt } = summary;
  const unscored = completedInterviews - scoredReports;

  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="sr-only">Performance overview</h2>
      <dl className={METRIC_LIST}>
        <Metric
          label="Completed interviews"
          value={completedInterviews}
          context={lastCompletedAt ? `Last completed ${formatDay(lastCompletedAt)}` : 'No completed interviews yet'}
        />
        <Metric
          label="Average score"
          value={averageScore === null ? '—' : formatScore(averageScore)}
          suffix={averageScore === null ? undefined : '/ 100'}
          context={
            averageScore === null
              ? 'No scored reports yet'
              : `Across ${scoredReports} scored ${scoredReports === 1 ? 'report' : 'reports'}${unscored > 0 ? ` · ${unscored} without a score` : ''}`
          }
        />
        <Metric
          label="Best score"
          value={bestScore === null ? '—' : formatScore(bestScore)}
          suffix={bestScore === null ? undefined : '/ 100'}
          context={
            bestReport ? (
              <Link
                href={`/reports/${bestReport.interviewId}`}
                className="rounded text-slate-300 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                {formatFocusArea(bestReport.focusArea)}
                {bestReport.completedAt ? ` · ${formatDay(bestReport.completedAt)}` : ''}
              </Link>
            ) : (
              'No scored reports yet'
            )
          }
        />
      </dl>
    </section>
  );
}

// ---------- Recent reports ----------

function ReportRow({ item }: { item: InterviewHistoryItem }) {
  const title = formatFocusArea(item.focusArea);
  const meta = [formatInterviewType(item.type), formatDifficulty(item.difficulty)].filter(Boolean).join(' · ');
  const completed = formatDay(item.completedAt);
  const tone = scoreTone(item.overallScore);

  return (
    <li
      className={cn(
        'group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors motion-reduce:transition-none sm:px-5',
        'md:grid-cols-[minmax(0,1fr)_9rem_6rem_7rem] md:py-3',
        'hover:bg-white/[0.03] has-[a:focus-visible]:bg-white/[0.03] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset has-[a:focus-visible]:ring-brand-400'
      )}
    >
      {/* Interview */}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {meta}
          {/* Date sits under the title on small screens. */}
          <span className="md:hidden">{completed ? ` · ${completed}` : ''}</span>
        </p>
      </div>

      {/* Completed (desktop column) */}
      <p className="hidden text-sm text-slate-300 md:block">
        <time dateTime={item.completedAt}>{completed}</time>
      </p>

      {/* Score */}
      <p className="text-right md:text-left">
        {item.overallScore === null ? (
          <span className="text-sm text-slate-500">No score</span>
        ) : (
          <span className="text-sm tabular-nums">
            <span className={cn('font-semibold', SCORE_TEXT[tone])}>{formatScore(item.overallScore)}</span>
            <span className="text-slate-500"> / 100</span>
          </span>
        )}
      </p>

      {/* Action: the link covers the whole row, so the row is the click target. */}
      <div className="col-span-2 md:col-span-1 md:text-right">
        <Link
          href={`/reports/${item.interviewId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-300 transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-brand-200 focus-visible:outline-none motion-reduce:transition-none"
        >
          View report
          <span className="sr-only">
            : {title}, completed {completed}
          </span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

export function RecentReports({ reports, total }: { reports: InterviewHistoryItem[]; total: number }) {
  return (
    <section aria-labelledby="recent-heading">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id="recent-heading" className="text-base font-semibold text-white">
          Recent reports
        </h2>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 rounded text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none"
        >
          View all reports
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className={cn(SURFACE, 'overflow-hidden')}>
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,1fr)_9rem_6rem_7rem] gap-x-4 border-b border-white/[0.07] px-5 py-2.5 text-xs font-medium text-slate-500 md:grid"
        >
          <span>Interview</span>
          <span>Completed</span>
          <span>Score</span>
          <span className="sr-only">Action</span>
        </div>
        <ul className="divide-y divide-white/[0.06]">
          {reports.map((item) => (
            <ReportRow key={item.interviewId} item={item} />
          ))}
        </ul>
      </div>

      {total > reports.length && (
        <p className="mt-3 text-xs text-slate-400">
          Showing {reports.length} of {total} reports.
        </p>
      )}
    </section>
  );
}

// ---------- First use ----------

const FIRST_STEPS = [
  { icon: ClipboardList, title: 'Choose your interview', detail: 'Pick a track, difficulty, focus area and number of questions.' },
  { icon: Code2, title: 'Answer each question', detail: 'Write responses, and solve coding questions in the built-in editor.' },
  { icon: LineChart, title: 'Read your scored report', detail: 'See rubric scores, model answers and what to improve, saved here.' },
];

export function FirstInterviewPanel() {
  return (
    <section aria-labelledby="first-heading" className={cn(SURFACE, 'p-6 sm:p-8')}>
      <div className="max-w-2xl">
        <h2 id="first-heading" className="text-lg font-semibold text-white">
          Start your first interview
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
          You haven&apos;t completed an interview yet. Once you finish one, your scores and reports will appear on this
          dashboard.
        </p>
      </div>
      <ol className="mt-6 grid gap-3 md:grid-cols-3">
        {FIRST_STEPS.map(({ icon: Icon, title, detail }, i) => (
          <li key={title} className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                <Icon className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
              </span>
              <span className="font-mono text-[11px] text-slate-500">Step {i + 1}</span>
            </div>
            <p className="mt-3 text-sm font-medium text-white">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{detail}</p>
          </li>
        ))}
      </ol>
      <StartInterviewButton label="Start your first interview" className="mt-6" />
    </section>
  );
}

// ---------- Loading & error ----------

function Bar({ className }: { className: string }) {
  return <div className={cn('rounded bg-white/[0.06] motion-safe:animate-pulse', className)} />;
}

/** Same footprint as the loaded layout, so nothing jumps when data arrives. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-8">
      <span className="sr-only">Loading your dashboard…</span>
      <div aria-hidden="true" className={METRIC_LIST}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={METRIC_ITEM}>
            <Bar className="h-3 w-24" />
            <Bar className="row-span-2 h-5 w-12 sm:mt-3 sm:h-7 sm:w-16" />
            <Bar className="mt-2 h-3 w-32 sm:mt-3" />
          </div>
        ))}
      </div>
      <div aria-hidden="true">
        <Bar className="mb-3 h-4 w-28" />
        <div className={cn(SURFACE, 'divide-y divide-white/[0.06]')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 space-y-2">
                <Bar className="h-3.5 w-40" />
                <Bar className="h-3 w-28" />
              </div>
              <Bar className="hidden h-3 w-20 md:block" />
              <Bar className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={cn(SURFACE, 'flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center')}>
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-medium text-white">Dashboard unavailable</p>
        <p role="alert" className="mt-0.5 text-sm text-slate-400">
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3.5 text-sm font-medium text-white transition-colors hover:bg-white/5 motion-reduce:transition-none',
          FOCUS_RING
        )}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

// ---------- Page body ----------

/** Everything below the header, for each loading state. */
export function DashboardBody({ state, onRetry }: { state: DashboardState; onRetry: () => void }) {
  if (state.status === 'loading') return <DashboardSkeleton />;
  if (state.status === 'error') return <DashboardError message={state.message} onRetry={onRetry} />;
  if (state.summary.completedInterviews === 0) return <FirstInterviewPanel />;
  return (
    <div className="space-y-8">
      <MetricsOverview summary={state.summary} />
      <RecentReports reports={state.recent} total={state.summary.completedInterviews} />
    </div>
  );
}
