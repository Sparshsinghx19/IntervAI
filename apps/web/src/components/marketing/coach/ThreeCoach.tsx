'use client';

import { Component, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { CoachScene } from './CoachScene';
import { CoachStaticFallback } from './CoachFallback';
import type { CoachPointer, ThreeCoachProps } from './types';

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
class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <CoachStaticFallback /> : this.props.children;
  }
}

export function ThreeCoach({ className }: ThreeCoachProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<CoachPointer>({ x: 0, y: 0, active: false, lastMove: 0 });
  const [visible, setVisible] = useState(true);

  const hasWebGL = useSyncExternalStore(noopSubscribe, detectWebGL, () => true);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)', true);
  const smallScreen = useMediaQuery('(max-width: 767px)');
  const cores = useSyncExternalStore(noopSubscribe, () => navigator.hardwareConcurrency || 8, () => 8);
  const lowPower = smallScreen || !finePointer || cores <= 4;

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
    if (!finePointer || reducedMotion) {
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
  }, [finePointer, reducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[400px] lg:h-[550px] flex items-center justify-center z-10 pointer-events-auto ${className || ''}`}
    >
      {hasWebGL ? (
        <WebGLBoundary>
          <Canvas
            camera={{ position: [0, 0.16, 9], fov: 26, near: 0.1, far: 50 }}
            dpr={[1, lowPower ? 1.25 : 1.75]}
            frameloop={visible ? 'always' : 'never'}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.NeutralToneMapping;
              gl.toneMappingExposure = 1.0;
            }}
            fallback={<CoachStaticFallback />}
            aria-label="Interactive 3D IntervAI coach"
          >
            <Suspense fallback={null}>
              <CoachScene
                pointer={pointer}
                reducedMotion={reducedMotion}
                lowPower={lowPower}
                allowDrag={finePointer && !reducedMotion}
              />
            </Suspense>
          </Canvas>
        </WebGLBoundary>
      ) : (
        <CoachStaticFallback />
      )}
    </div>
  );
}
