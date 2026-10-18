/**
 * What the coach is doing, driven by real application state:
 * - idle: ready (gentle breathing, soft eye glow)
 * - thinking: a real request is pending (gaze up, focused eyes, quicker core pulse)
 * - complete: the session is finished (calm, slower pulse)
 * There is deliberately no "listening" or "speaking" state: the app has no microphone or voice.
 */
export type CoachMood = 'idle' | 'thinking' | 'complete';

/** `hero` is the full-body landing-page scene; `compact` frames head and shoulders for small panels. */
export type CoachVariant = 'hero' | 'compact';

export interface ThreeCoachProps {
  mood?: CoachMood;
  variant?: CoachVariant;
  className?: string;
}

/** Normalised page pointer (-1..1 around the coach), written by a listener, read per frame. */
export interface CoachPointer {
  x: number;
  y: number;
  active: boolean;
  lastMove: number;
}
