'use client';

import { motion } from "framer-motion";
import { Check } from "lucide-react";
// three.js is client-only and heavy: the coach loads in its own chunk, retrying
// once and falling back to the static coach if that chunk can't be fetched.
import { LazyThreeCoach as ThreeCoach } from "@/components/marketing/coach/LazyCoach";
import { PrimaryLink, SecondaryLink, container } from "@/components/marketing/primitives";

const FACTS = [
  { value: "3 tracks", detail: "Technical, behavioral, HR" },
  { value: "6 focus areas", detail: "From DSA to system design" },
  { value: "C++ · Python", detail: "Run live in a sandbox" },
];

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-12 md:pt-32 lg:pb-20">
      {/* Grid that fades out toward the edges, plus two quiet light sources */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_70%_60%_at_60%_40%,black,transparent)]"
      />
      <div aria-hidden className="pointer-events-none absolute right-[-10%] top-[8%] h-[640px] w-[640px] rounded-full bg-brand-600/20 blur-[140px]" />
      <div aria-hidden className="pointer-events-none absolute right-[18%] bottom-[-12%] h-[320px] w-[420px] rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className={`${container} relative grid grid-cols-[minmax(0,1fr)] items-center gap-6 lg:min-h-[min(calc(100svh-8rem),760px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-4`}>
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="relative z-10 max-w-xl"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-300/80 sm:tracking-[0.2em]">
            Mock interviews · Coding · Scored feedback
          </p>
          <h1 className="mt-6 text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.25rem]">
            Practise the <span className="text-gradient-brand">hard parts</span> of the interview.
          </h1>
          <p className="mt-6 max-w-[32rem] text-pretty text-lg leading-relaxed text-slate-400">
            Choose a track and a topic. Answer real interview questions, solve coding problems in the browser, then get a
            scored report on what to fix next.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <PrimaryLink href="/interview">Start a practice interview</PrimaryLink>
            <SecondaryLink href="#feedback">See a sample report</SecondaryLink>
          </div>
          <p className="mt-4 text-sm text-slate-500">Sign in to save every report. Setting up a session takes four choices.</p>

          <dl className="mt-10 grid max-w-lg gap-2.5 border-t border-white/[0.08] pt-6 sm:mt-12 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-white/[0.08]">
            {FACTS.map((fact) => (
              <div key={fact.value} className="flex items-baseline gap-2 sm:block sm:px-4 sm:first:pl-0 sm:last:pr-0">
                <dt className="text-[15px] font-medium text-white">{fact.value}</dt>
                <dd className="text-[13px] leading-snug text-slate-500 sm:mt-1">{fact.detail}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        {/* Coach */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.15, ease }}
          className="relative mx-auto w-full max-w-[600px]"
        >
          {/* Fixed-height slot so the loader and canvas never shift the layout */}
          <div className="relative h-[380px] sm:h-[460px] lg:h-[600px]">
            <ThreeCoach className="h-full" />
          </div>

          {/* Two labelled sample read-outs beside the legs, where the silhouette is narrowest, so they never cover the coach */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease }}
            className="pointer-events-none absolute left-0 top-[77%] hidden w-[176px] rounded-xl border border-white/10 bg-obsidian/90 p-3.5 backdrop-blur-md sm:block"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Sample · Run code</p>
            <p className="mt-2 text-sm font-medium text-white">Valid Palindrome</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-cyan-300">
              <Check aria-hidden className="h-3.5 w-3.5" /> 3 / 3 sample tests passed
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85, ease }}
            className="pointer-events-none absolute right-0 top-[71%] hidden w-[176px] rounded-xl border border-white/10 bg-obsidian/90 p-3.5 backdrop-blur-md sm:block"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Sample report</p>
            {[
              { label: "Correctness", score: 85 },
              { label: "Clarity", score: 70 },
            ].map((row) => (
              <div key={row.label} className="mt-2.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-400">{row.label}</span>
                  <span className="font-mono text-white">{row.score}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-brand-400" style={{ width: `${row.score}%` }} />
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
