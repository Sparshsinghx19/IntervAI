import type { CoachMood } from '@/components/marketing/coach/types';

/**
 * What the AI companion shows, derived only from real application state.
 * "thinking" means a request is actually pending; there is no listening or
 * speaking state because the app has no microphone or voice.
 */
export type CompanionTone = 'ready' | 'busy' | 'success' | 'error' | 'done';

export interface CompanionStatus {
  mood: CoachMood;
  /** Sentence for the companion panel. */
  label: string;
  /** One or two words for the header pill. */
  short: string;
  tone: CompanionTone;
}

export interface SessionCompanionInput {
  evaluationStage: 'idle' | 'saving' | 'saved' | 'save_error' | string;
  isGeneratingReport: boolean;
  isInterviewComplete: boolean;
  timeUp?: boolean;
}

export function sessionCompanion(s: SessionCompanionInput): CompanionStatus {
  if (s.isGeneratingReport) {
    return { mood: 'thinking', label: 'Evaluating your answers…', short: 'Evaluating', tone: 'busy' };
  }
  if (s.evaluationStage === 'saving') {
    return { mood: 'thinking', label: 'Saving your answer…', short: 'Saving', tone: 'busy' };
  }
  if (s.isInterviewComplete) {
    return {
      mood: 'complete',
      label: s.timeUp ? 'Time is up. Only submitted answers are evaluated.' : 'Interview complete.',
      short: 'Completed',
      tone: 'done',
    };
  }
  if (s.evaluationStage === 'save_error') {
    return { mood: 'idle', label: 'Your answer wasn’t saved. Try submitting again.', short: 'Ready', tone: 'error' };
  }
  if (s.evaluationStage === 'saved') {
    return { mood: 'idle', label: 'Answer saved.', short: 'Ready', tone: 'success' };
  }
  return { mood: 'idle', label: 'Ready for your answer.', short: 'Ready', tone: 'ready' };
}

export function setupCompanion(s: { isPreparing: boolean; isValid: boolean; completed: number; total: number }): CompanionStatus {
  if (s.isPreparing) {
    return { mood: 'thinking', label: 'Preparing your interview…', short: 'Preparing', tone: 'busy' };
  }
  if (s.isValid) return { mood: 'idle', label: 'Ready to initiate', short: 'Ready', tone: 'ready' };
  return { mood: 'idle', label: `${s.completed}/${s.total} configured`, short: 'Setting up', tone: 'ready' };
}
