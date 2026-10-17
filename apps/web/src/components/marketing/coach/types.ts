export type CoachState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'evaluating';

export interface ThreeCoachProps {
  state?: CoachState;
  className?: string;
}

/** Normalised page pointer (-1..1 around the coach), written by a listener, read per frame. */
export interface CoachPointer {
  x: number;
  y: number;
  active: boolean;
  lastMove: number;
}
