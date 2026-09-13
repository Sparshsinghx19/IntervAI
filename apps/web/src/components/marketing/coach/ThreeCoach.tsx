'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader2 } from 'lucide-react';
import { CoachScene } from './CoachScene';
import { ThreeCoachProps } from './types';

function CanvasLoader() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-obsidian/50 rounded-[4rem] border border-white/5 shadow-inner -z-10">
      <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-4" />
      <span className="text-xs text-brand-400 font-mono tracking-widest uppercase opacity-70">Initializing R3F...</span>
    </div>
  );
}

export function ThreeCoach({ state = 'idle', className }: ThreeCoachProps) {
  return (
    <div className={`relative w-full h-[400px] lg:h-[550px] flex items-center justify-center z-10 pointer-events-auto ${className || ''}`}>
      <Suspense fallback={<CanvasLoader />}>
        <Canvas 
          camera={{ position: [0, 0, 8], fov: 45 }}
          dpr={[1, 1.5]} // Clamp pixel ratio for performance
          gl={{ antialias: true, alpha: true }}
        >
          <CoachScene />
        </Canvas>
      </Suspense>
    </div>
  );
}
