'use client';

import dynamic from 'next/dynamic';
import { CoachLoader, CompactCoachLoader } from './CoachFallback';
import { loadCoachWithFallback } from './load-coach';

// three.js is client-only and heavy: the coach loads in its own chunk (see load-coach.ts for retry/fallback).
const loadThreeCoach = () => import('./ThreeCoach').then((m) => m.ThreeCoach);

/** Full-body landing-page coach. */
export const LazyThreeCoach = dynamic(() => loadCoachWithFallback(loadThreeCoach), {
  ssr: false,
  loading: () => <CoachLoader />,
});

/** Small head-and-shoulders companion for panels (pass `variant="compact"`). */
export const LazyCompactCoach = dynamic(() => loadCoachWithFallback(loadThreeCoach), {
  ssr: false,
  loading: () => <CompactCoachLoader />,
});
