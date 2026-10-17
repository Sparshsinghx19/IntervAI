'use client';

import Link from 'next/link';
import { MotionConfig, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/**
 * Landing-page design system.
 * - Content width: 72rem, gutters 20px → 32px.
 * - Section rhythm: 96px mobile, 128px desktop.
 * - Type: Geist; mono for eyebrows, labels and data.
 * - Violet = brand / primary action, cyan = execution & passing states, amber = things to improve.
 */

export const container = 'mx-auto w-full max-w-6xl px-5 sm:px-8';

export function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn('relative scroll-mt-20 overflow-x-clip py-24 md:py-32', className)}>
      <div className={container}>{children}</div>
    </section>
  );
}

export function Eyebrow({ index, children, className }: { index?: string; children: ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-brand-300/80', className)}>
      {index && (
        <>
          <span className="text-slate-500">{index}</span>
          <span aria-hidden className="h-px w-6 bg-white/15" />
        </>
      )}
      {children}
    </p>
  );
}

export function Heading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn('mt-5 max-w-2xl text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.025em] text-white md:text-[2.75rem]', className)}>
      {children}
    </h2>
  );
}

export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-400 md:text-lg', className)}>{children}</p>;
}

/** Fade-up on first entry. MotionConfig reducedMotion="user" (set on the page) turns it into a plain fade. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function PrimaryLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-500 px-6 text-[15px] font-medium text-white',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_30px_-10px_rgba(139,92,246,0.7)] transition-colors duration-200 hover:bg-brand-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian',
        className,
      )}
    >
      {children}
      <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

export function SecondaryLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex h-12 items-center justify-center rounded-full border border-white/12 px-6 text-[15px] font-medium text-slate-200 transition-colors duration-200',
        'hover:border-white/25 hover:bg-white/[0.04] hover:text-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian',
        className,
      )}
    >
      {children}
    </a>
  );
}

/** Small tag that marks a visual as illustrative rather than the visitor's own data. */
export function SampleTag({ children = 'Sample data', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400', className)}>
      <span aria-hidden className="h-1 w-1 rounded-full bg-slate-500" />
      {children}
    </span>
  );
}

/** Product-preview frame: a quiet window with a route label instead of fake browser chrome. */
export function PreviewFrame({ label, tag, children, className }: { label: string; tag?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a12] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4 py-2.5">
        <span className="truncate font-mono text-[11px] text-slate-500">{label}</span>
        {tag}
      </div>
      {children}
    </div>
  );
}

/** Page-level motion settings: honour the OS reduced-motion preference for every framer animation. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
