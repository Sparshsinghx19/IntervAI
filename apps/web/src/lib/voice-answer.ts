import { API_URL, apiFetch } from './api-client';

/**
 * Voice answers: record in the browser, transcribe on the server, review in
 * the editor. Nothing here saves or submits an answer; the candidate always
 * submits manually.
 *
 * Audio is captured as raw PCM through the Web Audio API and encoded as 16 kHz
 * mono 16-bit WAV, a format every major browser can produce without codecs
 * and that the Gemini API accepts for audio input.
 */

export const VOICE_SAMPLE_RATE = 16000;
export const VOICE_MAX_SECONDS = 180;

// ---------- Encoding (pure) ----------

/** Averages samples down to the target rate (input is always >= 16 kHz in browsers). */
export function downsample(input: Float32Array, fromRate: number, toRate = VOICE_SAMPLE_RATE): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, sampleRate = VOICE_SAMPLE_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return buffer;
}

export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- Applying a transcript (pure) ----------

export type ApplyMode = 'replace' | 'append';

export function mergeTranscript(current: string, transcript: string, mode: ApplyMode): string {
  const t = transcript.trim();
  if (mode === 'replace' || !current.trim()) return t;
  return `${current.replace(/\s+$/, '')}\n\n${t}`;
}

/**
 * A transcript may fill the editor on its own only if the editor was empty when
 * recording started and is still exactly that now. Otherwise the candidate
 * chooses append or replace, so typed text (including text typed while the
 * transcription was running) is never overwritten silently.
 */
export function canAutoInsert(textAtStart: string, currentText: string): boolean {
  return textAtStart.trim() === '' && currentText === textAtStart;
}

// ---------- State machine (pure) ----------

export type VoiceErrorKind = 'permission' | 'unsupported' | 'recording' | 'network' | 'provider' | 'closed' | 'audio';

export type VoiceState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'recording'; startedAt: number }
  | { status: 'transcribing' }
  | { status: 'review'; transcript: string }
  | { status: 'inserted' }
  | { status: 'error'; kind: VoiceErrorKind; message: string };

export type VoiceEvent =
  | { type: 'request' }
  | { type: 'started'; at: number }
  | { type: 'stopped' }
  | { type: 'transcribed'; transcript: string; autoInserted: boolean }
  | { type: 'applied' }
  | { type: 'failed'; kind: VoiceErrorKind; message: string }
  | { type: 'reset' };

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case 'request':
      return state.status === 'recording' || state.status === 'transcribing' ? state : { status: 'requesting' };
    case 'started':
      return state.status === 'requesting' ? { status: 'recording', startedAt: event.at } : state;
    case 'stopped':
      return state.status === 'recording' ? { status: 'transcribing' } : state;
    case 'transcribed':
      if (state.status !== 'transcribing') return state; // a cancelled request's result is ignored
      return event.autoInserted ? { status: 'inserted' } : { status: 'review', transcript: event.transcript };
    case 'applied':
      return state.status === 'review' ? { status: 'inserted' } : state;
    case 'failed':
      return { status: 'error', kind: event.kind, message: event.message };
    case 'reset':
      return { status: 'idle' };
  }
}

// ---------- Microphone recording ----------

export interface ActiveRecording {
  /** Stops recording, releases the microphone, and returns the WAV audio. */
  stop: () => Promise<Blob>;
  /** Releases the microphone and discards the audio. */
  cancel: () => void;
}

const WORKLET = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('intervai-capture', Capture);
`;

export class VoiceRecordingError extends Error {
  constructor(public kind: VoiceErrorKind, message: string) {
    super(message);
  }
}

export function voiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.AudioContext !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined'
  );
}

export async function startVoiceRecording(): Promise<ActiveRecording> {
  if (!voiceRecordingSupported()) {
    throw new VoiceRecordingError('unsupported', 'Voice answers aren’t supported in this browser. You can type your answer instead.');
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new VoiceRecordingError('permission', 'Microphone access was blocked. Allow it in your browser’s site settings, or type your answer.');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new VoiceRecordingError('recording', 'No microphone was found. Connect one and try again, or type your answer.');
    }
    throw new VoiceRecordingError('recording', 'The microphone couldn’t be started. Try again, or type your answer.');
  }

  const context = new AudioContext();
  const chunks: Float32Array[] = [];
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    stream.getTracks().forEach((t) => t.stop());
    void context.close().catch(() => undefined);
  };

  try {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await context.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, 'intervai-capture');
    node.port.onmessage = (e: MessageEvent<Float32Array>) => chunks.push(e.data);
    source.connect(node);
  } catch {
    release();
    throw new VoiceRecordingError('recording', 'Recording couldn’t be started in this browser. You can type your answer instead.');
  }

  return {
    stop: async () => {
      const rate = context.sampleRate;
      release();
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const all = new Float32Array(total);
      let offset = 0;
      for (const c of chunks) {
        all.set(c, offset);
        offset += c.length;
      }
      const capped = all.subarray(0, Math.min(all.length, rate * VOICE_MAX_SECONDS));
      return new Blob([encodeWav(downsample(capped, rate))], { type: 'audio/wav' });
    },
    cancel: release,
  };
}

// ---------- Upload ----------

export type TranscribeResult =
  | { ok: true; transcript: string; durationSeconds: number }
  | { ok: false; kind: VoiceErrorKind; message: string };

export async function transcribeAnswer(
  args: { interviewId: string; questionId: string; audio: Blob; signal?: AbortSignal },
  { fetchFn = apiFetch, apiUrl = API_URL }: { fetchFn?: typeof fetch; apiUrl?: string } = {}
): Promise<TranscribeResult> {
  let res: Response;
  try {
    res = await fetchFn(
      `${apiUrl}/api/interviews/${encodeURIComponent(args.interviewId)}/transcribe?questionId=${encodeURIComponent(args.questionId)}`,
      { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: args.audio, signal: args.signal }
    );
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    return { ok: false, kind: 'network', message: 'Couldn’t reach the server. Check your connection and try again.' };
  }
  const body = (await res.json().catch(() => null)) as { transcript?: string; durationSeconds?: number; error?: string } | null;
  if (res.ok && typeof body?.transcript === 'string') {
    return { ok: true, transcript: body.transcript, durationSeconds: body.durationSeconds ?? 0 };
  }
  if (res.status === 409) {
    return { ok: false, kind: 'closed', message: 'This interview has ended, so the recording wasn’t transcribed.' };
  }
  if (res.status === 429) {
    return { ok: false, kind: 'provider', message: 'You’ve transcribed several recordings recently. Please wait a few minutes or type your answer.' };
  }
  if (res.status === 401) {
    return { ok: false, kind: 'network', message: 'Your session has expired. Log in again to continue.' };
  }
  if (res.status === 413 || res.status === 415 || res.status === 422) {
    return { ok: false, kind: 'audio', message: body?.error || 'That recording couldn’t be used. Please record again.' };
  }
  return { ok: false, kind: 'provider', message: body?.error || 'Transcription failed. Please try again or type your answer.' };
}
