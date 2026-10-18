'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AlertCircle, Loader2, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ActiveRecording,
  ApplyMode,
  canAutoInsert,
  formatElapsed,
  mergeTranscript,
  startVoiceRecording,
  transcribeAnswer,
  VOICE_MAX_SECONDS,
  VoiceRecordingError,
  voiceReducer,
  VoiceState,
} from '@/lib/voice-answer';

interface ViewProps {
  state: VoiceState;
  elapsedSeconds: number;
  disabled?: boolean;
  onRecord: () => void;
  onStop: () => void;
  onApply: (mode: ApplyMode) => void;
  onDismiss: () => void;
}

/** Presentational voice controls (no browser APIs), one compact row above the editor. */
export function VoiceAnswerView({ state, elapsedSeconds, disabled, onRecord, onStop, onApply, onDismiss }: ViewProps) {
  const busy = state.status === 'requesting' || state.status === 'transcribing';
  return (
    <div className="flex flex-col gap-2" data-testid="voice-answer">
      <div className="flex flex-wrap items-center gap-2">
        {state.status === 'recording' ? (
          <Button
            type="button"
            variant="outline"
            onClick={onStop}
            className="h-8 px-3 text-xs border-rose-400/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
          >
            <Square className="w-3 h-3 mr-1.5 fill-current" aria-hidden="true" /> Stop recording
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={onRecord}
            disabled={disabled || busy}
            className="h-8 px-3 text-xs border-white/10 text-slate-200 hover:bg-white/5"
          >
            <Mic className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            {state.status === 'review' || state.status === 'inserted' || state.status === 'error' ? 'Record again' : 'Record answer'}
          </Button>
        )}

        <p role="status" aria-live="polite" className="text-xs text-slate-400 min-w-0" data-testid="voice-status">
          {state.status === 'idle' && <span className="hidden sm:inline">Speak your answer instead of typing. You’ll review it before submitting.</span>}
          {state.status === 'requesting' && 'Waiting for microphone permission…'}
          {state.status === 'recording' && (
            <span className="inline-flex items-center gap-1.5 text-rose-200">
              <span className="w-2 h-2 rounded-full bg-rose-400" aria-hidden="true" />
              Recording <span className="font-mono">{formatElapsed(elapsedSeconds)}</span>
              <span className="text-slate-500">/ {formatElapsed(VOICE_MAX_SECONDS)}</span>
            </span>
          )}
          {state.status === 'transcribing' && (
            <span className="inline-flex items-center gap-1.5 text-cyan-200">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Transcribing your recording…
            </span>
          )}
          {state.status === 'inserted' && <span className="text-emerald-300">Transcript added. Review and edit it, then submit when ready.</span>}
          {state.status === 'review' && <span className="text-slate-300">Transcript ready. Your answer already has text, so choose how to use it.</span>}
        </p>
      </div>

      {state.status === 'review' && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2" data-testid="voice-review">
          <p className="text-sm text-slate-200 whitespace-pre-wrap max-h-32 overflow-y-auto">{state.transcript}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onApply('append')} className="h-8 px-3 text-xs border-brand-400/30 text-brand-100 hover:bg-brand-500/15">
              Append to answer
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onApply('replace')} className="h-8 px-3 text-xs border-white/10 text-slate-200 hover:bg-white/5">
              Replace answer
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDismiss} className="h-8 px-3 text-xs text-slate-400 hover:text-slate-200">
              Discard
            </Button>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div role="alert" className="flex items-start justify-between gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-200">
          <span className="inline-flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
            {state.message}
          </span>
          <button type="button" onClick={onDismiss} className="shrink-0 underline underline-offset-2 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-300 rounded">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

interface VoiceAnswerProps {
  interviewId: string;
  questionId: string;
  /** Current editor text. */
  text: string;
  /** Writes text into the editor (and its draft). Never submits. */
  onTextChange: (text: string) => void;
  disabled?: boolean;
}

/**
 * Record → transcribe → review. Only fills the editor; the candidate submits manually.
 * The microphone is released when recording stops, the question changes, or the page is left.
 */
export function VoiceAnswer({ interviewId, questionId, text, onTextChange, disabled }: VoiceAnswerProps) {
  const [state, dispatch] = useReducer(voiceReducer, { status: 'idle' } as VoiceState);
  const [now, setNow] = useState(() => Date.now());
  const recording = useRef<ActiveRecording | null>(null);
  const request = useRef<AbortController | null>(null);
  const textAtStart = useRef('');
  const latestText = useRef(text);

  useEffect(() => {
    latestText.current = text;
  }, [text]);

  const cleanup = useCallback(() => {
    recording.current?.cancel();
    recording.current = null;
    request.current?.abort();
    request.current = null;
  }, []);

  // A new question (or leaving the page) cancels any recording or pending transcription.
  useEffect(() => {
    dispatch({ type: 'reset' });
    return cleanup;
  }, [questionId, cleanup]);

  useEffect(() => {
    window.addEventListener('pagehide', cleanup);
    return () => window.removeEventListener('pagehide', cleanup);
  }, [cleanup]);

  const stop = useCallback(async () => {
    const active = recording.current;
    if (!active) return;
    recording.current = null;
    dispatch({ type: 'stopped' });
    const audio = await active.stop();
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await transcribeAnswer({ interviewId, questionId, audio, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!result.ok) {
        dispatch({ type: 'failed', kind: result.kind, message: result.message });
        return;
      }
      // Fill an empty, untouched editor; otherwise let the candidate choose.
      const auto = canAutoInsert(textAtStart.current, latestText.current);
      if (auto) onTextChange(mergeTranscript('', result.transcript, 'replace'));
      dispatch({ type: 'transcribed', transcript: result.transcript, autoInserted: auto });
    } catch {
      // Aborted because the question changed or the page was left.
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [interviewId, questionId, onTextChange]);

  // Elapsed time while recording; stops automatically at the length limit.
  const startedAt = state.status === 'recording' ? state.startedAt : null;
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - startedAt >= VOICE_MAX_SECONDS * 1000) void stop();
    }, 250);
    return () => clearInterval(id);
  }, [startedAt, stop]);

  const record = async () => {
    dispatch({ type: 'request' });
    textAtStart.current = latestText.current;
    try {
      recording.current = await startVoiceRecording();
      const at = Date.now();
      setNow(at);
      dispatch({ type: 'started', at });
    } catch (err) {
      const e = err instanceof VoiceRecordingError ? err : new VoiceRecordingError('recording', 'Recording couldn’t be started.');
      dispatch({ type: 'failed', kind: e.kind, message: e.message });
    }
  };

  const apply = (mode: ApplyMode) => {
    if (state.status !== 'review') return;
    onTextChange(mergeTranscript(latestText.current, state.transcript, mode));
    dispatch({ type: 'applied' });
  };

  return (
    <VoiceAnswerView
      state={state}
      elapsedSeconds={startedAt === null ? 0 : (now - startedAt) / 1000}
      disabled={disabled}
      onRecord={record}
      onStop={() => void stop()}
      onApply={apply}
      onDismiss={() => {
        cleanup();
        dispatch({ type: 'reset' });
      }}
    />
  );
}
