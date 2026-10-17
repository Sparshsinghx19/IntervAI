import Link from 'next/link';
import { Code2, LineChart, MessagesSquare } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: MessagesSquare, title: 'Three interview tracks', detail: 'Technical, behavioral and HR questions matched to your level.' },
  { icon: Code2, title: 'A real coding workspace', detail: 'Write and run solutions against sample and hidden tests.' },
  { icon: LineChart, title: 'Reports you can revisit', detail: 'Scored feedback, model answers and what to practise next.' },
];

function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-4 focus-visible:ring-offset-obsidian"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 shadow-glow">
        <span className="text-lg font-bold leading-none tracking-tighter text-white">IV</span>
      </span>
      <span className="text-xl font-bold tracking-tight text-white">IntervAI</span>
    </Link>
  );
}

/**
 * Page frame for the login and sign-up screens: obsidian backdrop with soft
 * violet/indigo light and a restrained cyan accent, and a frosted-glass card.
 * On large screens a short product summary sits beside the card.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-obsidian text-foreground selection:bg-brand-500/30">
      {/* Backdrop lighting (decorative) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-pattern opacity-60 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_35%,black,transparent)]" />
        <div className="absolute left-1/2 top-[-22%] h-[560px] w-[min(900px,140vw)] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[140px]" />
        <div className="absolute bottom-[-25%] left-[-12%] h-[460px] w-[560px] rounded-full bg-indigo-600/15 blur-[130px]" />
        <div className="absolute bottom-[6%] right-[-10%] h-[300px] w-[380px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-12 px-4 py-10 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-20">
        <aside className="hidden lg:block">
          <Logo />
          <p className="mt-14 font-mono text-[11px] uppercase tracking-[0.2em] text-brand-300/80">Interview practice, scored</p>
          <h2 className="mt-5 max-w-md text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
            Practise the <span className="text-gradient-brand">hard parts</span> of the interview.
          </h2>
          <ul className="mt-10 max-w-md space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title: itemTitle, detail }) => (
              <li key={itemTitle} className="flex gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                  <Icon className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{itemTitle}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-400">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="mx-auto w-full max-w-[440px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>

          <div className="relative rounded-3xl border border-white/[0.09] bg-white/[0.035] p-6 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85),0_0_60px_-20px_rgba(124,58,237,0.25)] backdrop-blur-2xl motion-safe:animate-[auth-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_both] sm:p-9">
            {/* Glass highlights (decorative) */}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.07] via-transparent to-brand-500/[0.05]" />
            <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute -bottom-px left-1/2 h-px w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

            <div className="relative">
              <h1 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.02em] text-white">{title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>
              <div className="mt-8">{children}</div>
            </div>
          </div>

          <div className="mt-7 text-center text-sm text-slate-400">{footer}</div>
        </main>
      </div>
    </div>
  );
}
