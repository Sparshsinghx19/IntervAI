import { Loader2 } from 'lucide-react';

/** Shown while the 3D bundle streams in. Kept free of three.js imports. */
export function CoachLoader() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-4" />
      <span className="text-xs text-brand-400 font-mono tracking-widest uppercase opacity-70">Initializing coach...</span>
    </div>
  );
}

/** Small placeholder for compact panels while the 3D bundle streams in. */
export function CompactCoachLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div className="w-1/2 aspect-square rounded-full bg-brand-500/15 animate-pulse" />
    </div>
  );
}

/** Static stand-in when WebGL (or the 3D bundle) is unavailable: the coach's glowing IV core. */
export function CoachStaticFallback({ variant = 'hero' }: { variant?: 'hero' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <div className="absolute inset-0 flex items-center justify-center" role="img" aria-label="IntervAI coach">
        <div className="absolute w-3/4 aspect-square rounded-full bg-brand-500/20 blur-xl" />
        <div className="relative w-1/2 aspect-square rounded-full bg-obsidian border-2 border-brand-500/60 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.5),inset_0_0_14px_rgba(139,92,246,0.45)]">
          <span className="text-sm font-black tracking-tight text-violet-100 drop-shadow-[0_0_8px_rgba(192,132,252,0.9)]">IV</span>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center" role="img" aria-label="IntervAI coach">
      <div className="absolute w-64 h-64 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="relative w-28 h-28 rounded-full bg-obsidian border-4 border-brand-500/60 flex items-center justify-center shadow-[0_0_60px_rgba(139,92,246,0.55),inset_0_0_30px_rgba(139,92,246,0.5)]">
        <span className="text-4xl font-black tracking-tight text-violet-100 drop-shadow-[0_0_12px_rgba(192,132,252,0.9)]">IV</span>
      </div>
    </div>
  );
}
