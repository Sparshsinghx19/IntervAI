export type CoachState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'evaluating';

export interface ThreeCoachProps {
  state?: CoachState;
  className?: string;
}
