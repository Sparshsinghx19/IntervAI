'use client';

import { Component, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { COMPACT_FRAME, CoachScene } from './CoachScene';
import { CoachStaticFallback } from './CoachFallback';
import type { CoachPointer, CoachVariant, ThreeCoachProps } from './types';

function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

let webglSupport: boolean | null = null;
function detectWebGL() {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement('canvas');
      webglSupport = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noopSubscribe = () => () => {};

/** Renders the static fallback if the WebGL renderer fails to start. */
class WebGLBoundary extends Component<{ children: ReactNode; variant: CoachVariant }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <CoachStaticFallback variant={this.props.variant} /> : this.props.children;
  }
}

// Full body for the landing hero; head and shoulders for small panels.
const CAMERAS = {
  hero: { position: [0, 0.16, 9] as [number, number, number], fov: 26 },
  compact: { position: [0, 0, COMPACT_FRAME.distance] as [number, number, number], fov: COMPACT_FRAME.fov },
};

// Compact portrait: a soft violet backdrop and a fade below the chest, so the bust reads as framed, not cropped.
const COMPACT_PORTRAIT =
  'bg-[radial-gradient(circle_at_50%_40%,rgba(139,92,246,0.22),transparent_70%)] [mask-image:linear-gradient(to_bottom,black_80%,transparent)]';

export function ThreeCoach({ className, mood = 'idle', variant = 'hero' }: ThreeCoachProps) {
  const compact = variant === 'compact';
  const containerRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<CoachPointer>({ x: 0, y: 0, active: false, lastMove: 0 });
  const [visible, setVisible] = useState(true);

  const hasWebGL = useSyncExternalStore(noopSubscribe, detectWebGL, () => true);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)', true);
  const smallScreen = useMediaQuery('(max-width: 767px)');
  const cores = useSyncExternalStore(noopSubscribe, () => navigator.hardwareConcurrency || 8, () => 8);
  // Compact panels are small: render cheaply and never capture pointer input.
  const lowPower = compact || smallScreen || !finePointer || cores <= 4;
  const allowDrag = !compact && finePointer && !reducedMotion;
  const trackPointer = !compact && finePointer && !reducedMotion;

  // Pause rendering while the hero is off-screen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Page-wide pointer tracking (desktop only) — written to a ref, read in the frame loop.
  useEffect(() => {
    if (!trackPointer) {
      pointer.current.active = false;
      return;
    }
    const onMove = (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.35;
      const p = pointer.current;
      p.x = THREE.MathUtils.clamp((e.clientX - cx) / (window.innerWidth * 0.5), -1, 1);
      p.y = THREE.MathUtils.clamp((e.clientY - cy) / (window.innerHeight * 0.5), -1, 1);
      p.active = true;
      p.lastMove = performance.now();
    };
    const onLeave = () => {
      pointer.current.active = false;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [trackPointer]);

  return (
    <div
      ref={containerRef}
      // The parent decides the size. Touch / reduced-motion visitors get no drag, so the canvas never captures scrolling.
      className={`relative w-full flex items-center justify-center ${allowDrag ? 'pointer-events-auto' : 'pointer-events-none'} ${compact ? COMPACT_PORTRAIT : ''} ${className ?? (compact ? 'h-24' : 'h-[400px] lg:h-[550px]')}`}
      // The compact companion is decorative; its status is given as text next to it.
      aria-hidden={compact || undefined}
    >
      {hasWebGL ? (
        <WebGLBoundary variant={variant}>
          <Canvas
            camera={{ ...CAMERAS[variant], near: 0.1, far: 50 }}
            dpr={[1, compact ? 1.5 : lowPower ? 1.25 : 1.75]}
            frameloop={visible ? 'always' : 'never'}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.NeutralToneMapping;
              gl.toneMappingExposure = 1.0;
            }}
            fallback={<CoachStaticFallback variant={variant} />}
            aria-label={compact ? undefined : 'Interactive 3D IntervAI coach'}
          >
            <Suspense fallback={null}>
              <CoachScene
                pointer={pointer}
                reducedMotion={reducedMotion}
                lowPower={lowPower}
                allowDrag={allowDrag}
                mood={mood}
                variant={variant}
              />
            </Suspense>
          </Canvas>
        </WebGLBoundary>
      ) : (
        <CoachStaticFallback variant={variant} />
      )}
    </div>
  );
}
