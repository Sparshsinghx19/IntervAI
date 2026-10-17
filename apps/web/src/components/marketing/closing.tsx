'use client';

import { focusAreas, interviewTypes } from '@/data/interview-options';
import { Eyebrow, Heading, PrimaryLink, Reveal, Section, SecondaryLink } from './primitives';

const REASONS = [
  {
    title: 'Theory and code in the same session',
    body: 'Explaining an idea and implementing it happen in one interview, so you practise both the way you will be asked.',
  },
  {
    title: 'Scored at the end, like the real thing',
    body: 'Nothing interrupts you mid-interview. Answers are evaluated together afterwards, so the report can point out patterns, not just single slips.',
  },
  {
    title: 'Ready in under a minute',
    body: 'A quick sign-up and no onboarding. Four choices and the first question is on screen.',
  },
];

export function WhySection() {
  return (
    <Section id="why" className="border-t border-white/[0.05]">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <Reveal>
          <Eyebrow index="04">Why it works this way</Eyebrow>
          <Heading>Built around how interviews actually go.</Heading>

          <div className="mt-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Tracks</p>
            <p className="mt-2 text-[15px] text-slate-300">{interviewTypes.map((t) => t.label).join(' · ')}</p>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Focus areas</p>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-300">{focusAreas.map((f) => f.label).join(' · ')}</p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <ol className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {REASONS.map((reason, i) => (
              <li key={reason.title} className="grid gap-2 py-7 sm:grid-cols-[3rem_minmax(0,1fr)]">
                <span className="font-mono text-[12px] text-brand-300/70">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-lg font-medium text-white">{reason.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{reason.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </Section>
  );
}

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.05] py-28 md:py-36">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/15 blur-[130px]" />
      <Reveal className="relative mx-auto flex max-w-3xl flex-col items-center px-5 text-center sm:px-8">
        {/* Echo of the coach's chest emblem */}
        <div aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-obsidian shadow-[0_0_40px_-6px_rgba(139,92,246,0.6)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-400/80">
            <span className="text-sm font-bold tracking-tight text-violet-100">IV</span>
          </div>
        </div>
        <h2 className="mt-8 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-white md:text-[3.25rem]">
          Your next practice session is four choices away.
        </h2>
        <p className="mt-5 max-w-lg text-pretty text-lg leading-relaxed text-slate-400">
          Pick a track, a difficulty, a topic and a length. The report is waiting at the end.
        </p>
        <div className="mt-10 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <PrimaryLink href="/interview">Start a practice interview</PrimaryLink>
          <SecondaryLink href="#session">How a session works</SecondaryLink>
        </div>
      </Reveal>
    </section>
  );
}
