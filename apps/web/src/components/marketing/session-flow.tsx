'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { difficulties, focusAreas, interviewTypes, questionCounts } from '@/data/interview-options';
import { Eyebrow, Heading, Lede, PreviewFrame, Reveal, SampleTag, Section } from './primitives';

const STEPS = [
  {
    title: 'Set up the session',
    body: 'Pick a track, a difficulty, a focus area and how many questions you want. That is the whole setup.',
  },
  {
    title: 'Answer the questions',
    body: 'Questions come from a bank for the topic you chose. Write your answer, submit it, and it is saved before you move on.',
  },
  {
    title: 'Solve the coding problems',
    body: 'Data structures and algorithms sessions give you real coding problems. Write, run and submit them inside the interview.',
  },
  {
    title: 'Read your report',
    body: 'Finish the session and every answer is scored together into one report: per-question scores, strengths, fixes and patterns.',
  },
];

function Chip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-lg border px-3 py-2 text-[13px]',
        active ? 'border-brand-400/60 bg-brand-500/15 text-white' : 'border-white/[0.08] bg-white/[0.02] text-slate-400',
      )}
    >
      {children}
    </span>
  );
}

function SetupPreview() {
  const groups = [
    { label: 'Interview type', options: interviewTypes.map((o) => o.label), active: 'Technical' },
    { label: 'Difficulty', options: difficulties.map((o) => o.label), active: 'Medium' },
    { label: 'Focus area', options: focusAreas.map((o) => o.label), active: 'Operating Systems' },
    { label: 'Length', options: questionCounts.map((o) => o.label), active: '5 Questions' },
  ];
  return (
    <div className="space-y-5 p-5 sm:p-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((opt) => (
              <Chip key={opt} active={opt === group.active}>
                {opt}
              </Chip>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-5">
        <span className="text-[13px] text-slate-500">~10–15 minutes</span>
        <span className="rounded-full bg-brand-500 px-4 py-2 text-[13px] font-medium text-white">Start Interview</span>
      </div>
    </div>
  );
}

function AnswerPreview() {
  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-slate-500">Question 2 of 5 · Operating Systems</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-400">THEORY</span>
      </div>
      <h3 className="mt-4 text-lg font-medium leading-snug text-white sm:text-xl">
        What is the difference between a process and a thread, and when would you choose one over the other?
      </h3>
      <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/30 p-4 text-[14px] leading-relaxed text-slate-300">
        A process has its own address space, so a crash in one doesn&apos;t take down another. Threads share the
        process&apos;s memory, which makes communication cheap but means shared state needs locking. I&apos;d use
        separate processes for isolation, threads for
        <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-brand-300 align-middle" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] text-cyan-300">
          <Check aria-hidden className="h-3.5 w-3.5" /> Question 1 answer saved
        </span>
        <span className="rounded-full bg-brand-500 px-4 py-2 text-[13px] font-medium text-white">Submit answer</span>
      </div>
    </div>
  );
}

function CodingPreview() {
  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-medium text-white">Reverse Linked List</span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">EASY</span>
        <span className="font-mono text-[11px] text-slate-500">Linked Lists · Pointers</span>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/40 p-4 font-mono text-[12.5px] leading-6 text-slate-300">
        <code>
          <span className="text-brand-300">def</span> <span className="text-cyan-300">reverseList</span>(self, head):{'\n'}
          {'    '}prev = <span className="text-amber-300">None</span>{'\n'}
          {'    '}<span className="text-brand-300">while</span> head:{'\n'}
          {'        '}head.next, prev, head = prev, head, head.next{'\n'}
          {'    '}<span className="text-brand-300">return</span> prev
        </code>
      </pre>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[13px] text-cyan-300">
          <Check aria-hidden className="h-3.5 w-3.5" /> 3 / 3 sample tests passed
        </span>
        <a href="#coding" className="inline-flex items-center gap-1 text-[13px] text-slate-300 hover:text-white">
          See the workspace <ArrowDown aria-hidden className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function ReportPreview() {
  const rows = [
    { label: 'Correctness', score: 82 },
    { label: 'Completeness', score: 70 },
    { label: 'Reasoning', score: 74 },
    { label: 'Clarity', score: 66 },
  ];
  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center gap-5">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-[5px] border-cyan-400/80">
          <span className="text-2xl font-semibold text-cyan-300">75</span>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">Overall · 5 of 5 evaluated</p>
          <p className="mt-1 text-lg font-medium text-white">Proficient</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-[13px]">
              <span className="text-slate-400">{row.label}</span>
              <span className="font-mono text-white">{row.score}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-cyan-400/80" style={{ width: `${row.score}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <a href="#feedback" className="inline-flex items-center gap-1 text-[13px] text-slate-300 hover:text-white">
          See a full report <ArrowDown aria-hidden className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

const PREVIEWS = [
  { label: 'intervai / interview', node: <SetupPreview /> },
  { label: 'intervai / interview / session', node: <AnswerPreview /> },
  { label: 'intervai / interview / session · coding', node: <CodingPreview /> },
  { label: 'intervai / interview / session · report', node: <ReportPreview /> },
];

export function SessionFlow() {
  const [active, setActive] = useState(0);
  const baseId = useId();

  // Arrow keys move between steps, as in a standard tablist.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const next = (active + dir + STEPS.length) % STEPS.length;
    setActive(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  return (
    <Section id="session" className="border-t border-white/[0.05]">
      <Reveal>
        <Eyebrow index="01">How a session works</Eyebrow>
        <Heading>One sitting, four steps, and an answer to “how did I do?”</Heading>
        <Lede>
          A session runs like a short interview: you set it up, work through the questions in order, and get one
          report at the end.
        </Lede>
      </Reveal>

      <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
        <Reveal>
          <div role="tablist" aria-orientation="vertical" aria-label="Session steps" className="relative">
            <span aria-hidden className="absolute bottom-6 left-[19px] top-6 w-px bg-white/[0.08]" />
            {STEPS.map((step, i) => {
              const selected = i === active;
              return (
                <button
                  key={step.title}
                  id={`${baseId}-tab-${i}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  onKeyDown={onKeyDown}
                  className={cn(
                    'relative -mx-3 flex w-[calc(100%+1.5rem)] gap-5 rounded-2xl px-3 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70',
                  )}
                >
                  <span
                    className={cn(
                      'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-[12px] transition-colors duration-300',
                      selected ? 'border-brand-400 bg-brand-500 text-white' : 'border-white/10 bg-obsidian text-slate-500',
                    )}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="pt-2">
                    <span className={cn('block text-[17px] font-medium transition-colors', selected ? 'text-white' : 'text-slate-400 hover:text-slate-200')}>
                      {step.title}
                    </span>
                    <span
                      className={cn(
                        'grid transition-[grid-template-rows,opacity] duration-300',
                        selected ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                      )}
                    >
                      <span className="overflow-hidden">
                        <span className="block pt-2 text-[15px] leading-relaxed text-slate-400">{step.body}</span>
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${active}`} className="relative">
            <PreviewFrame label={PREVIEWS[active].label} tag={<SampleTag>Preview</SampleTag>}>
              <div className="min-h-[360px]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    {PREVIEWS[active].node}
                  </motion.div>
                </AnimatePresence>
              </div>
            </PreviewFrame>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
