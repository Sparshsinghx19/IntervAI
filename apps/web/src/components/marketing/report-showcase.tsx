'use client';

import { ChevronRight, CircleCheck, CircleAlert } from 'lucide-react';
import { Eyebrow, Heading, Lede, PreviewFrame, Reveal, SampleTag, Section } from './primitives';

// Same rubric and weights the evaluator uses.
const RUBRIC = [
  { label: 'Correctness', weight: '40%', question: 'Are the facts and the logic right?' },
  { label: 'Completeness', weight: '25%', question: 'Did you cover the requirements and edge cases?' },
  { label: 'Reasoning', weight: '20%', question: 'Did you explain why, and the trade-offs?' },
  { label: 'Clarity', weight: '15%', question: 'Was it organised and easy to follow?' },
];

const SAMPLE_SCORES = [82, 68, 74, 70];

// Score bands match the report view: 85+ emerald, 70+ cyan, 55+ violet, below that amber.
function tone(score: number) {
  if (score >= 85) return { text: 'text-emerald-300', bar: 'bg-emerald-400', stroke: '#10b981' };
  if (score >= 70) return { text: 'text-cyan-300', bar: 'bg-cyan-400', stroke: '#06b6d4' };
  if (score >= 55) return { text: 'text-brand-300', bar: 'bg-brand-400', stroke: '#8b5cf6' };
  return { text: 'text-amber-300', bar: 'bg-amber-400', stroke: '#f59e0b' };
}

function ScoreRing({ score }: { score: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const t = tone(score);
  return (
    <div className="relative h-[84px] w-[84px] shrink-0">
      <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={t.stroke} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-2xl font-semibold ${t.text}`}>{score}</span>
    </div>
  );
}

function ReportPreview() {
  return (
    <PreviewFrame label="intervai / interview / session · report" tag={<SampleTag>Sample report</SampleTag>}>
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-5">
          <ScoreRing score={73} />
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Technical · Operating Systems · Medium</p>
            <p className="mt-1 text-xl font-medium text-white">Proficient</p>
            <p className="mt-0.5 text-[13px] text-slate-500">5 of 5 questions evaluated</p>
          </div>
        </div>

        <p className="mt-5 text-[14px] leading-relaxed text-slate-400">
          Solid on core definitions and scheduling. Answers lose marks when they stop at the definition and skip the
          trade-off or a concrete example.
        </p>

        {/* One question, expanded */}
        <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.015]">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
            <p className="min-w-0 truncate text-[14px] text-white">
              <span className="mr-2 font-mono text-[11px] text-slate-500">Q2</span>
              Process vs. thread — when to choose each
            </p>
            <span className={`font-mono text-[15px] ${tone(75).text}`}>75</span>
          </div>
          <div className="grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2">
            {RUBRIC.map((row, i) => {
              const score = SAMPLE_SCORES[i];
              const t = tone(score);
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-slate-400">
                      {row.label} <span className="text-slate-600">· {row.weight}</span>
                    </span>
                    <span className={`font-mono ${t.text}`}>{score}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${score}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-3 border-t border-white/[0.06] px-4 py-4 text-[13px] leading-relaxed sm:grid-cols-2">
            <p className="flex gap-2 text-slate-300">
              <CircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Clear distinction between separate and shared address spaces.
            </p>
            <p className="flex gap-2 text-slate-300">
              <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              Mention context-switch cost and give one example of each choice.
            </p>
          </div>
          <div className="flex items-center gap-1 border-t border-white/[0.06] px-4 py-3 text-[13px] text-slate-400">
            <ChevronRight aria-hidden className="h-4 w-4" /> Reference answer
          </div>
        </div>

        {/* Session-wide patterns */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Weak topics</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Deadlock prevention', 'Paging trade-offs'].map((t) => (
                <span key={t} className="rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-2 py-1 text-[12px] text-amber-200">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Practise next</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Scheduling with examples', 'Virtual memory'].map((t) => (
                <span key={t} className="rounded-md border border-brand-500/25 bg-brand-500/[0.08] px-2 py-1 text-[12px] text-brand-100">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

export function ReportShowcase() {
  return (
    <Section id="feedback" className="border-t border-white/[0.05]">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
        <Reveal className="order-2 lg:order-1" delay={0.1}>
          <ReportPreview />
        </Reveal>

        <Reveal className="order-1 lg:order-2 lg:sticky lg:top-28">
          <Eyebrow index="03">Feedback</Eyebrow>
          <Heading>A report that tells you what to practise next.</Heading>
          <Lede>
            When you finish, every answer is scored together. Each one gets four rubric scores, a short summary, what
            you did well, what to improve, and a reference answer to compare against.
          </Lede>

          <dl className="mt-9 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {RUBRIC.map((row) => (
              <div key={row.label} className="flex items-baseline gap-4 py-3.5">
                <dt className="w-28 shrink-0 text-[15px] text-white">{row.label}</dt>
                <dd className="flex-1 text-[14px] text-slate-400">{row.question}</dd>
                <dd className="font-mono text-[13px] text-slate-500">{row.weight}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 text-[14px] leading-relaxed text-slate-400">
            The report also looks across the whole session for recurring strengths, weak topics and repeated mistakes.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
            Scores are produced by an AI model against this rubric. Treat them as a guide, not a verdict.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
