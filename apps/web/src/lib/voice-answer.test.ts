import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  canAutoInsert,
  downsample,
  encodeWav,
  formatElapsed,
  mergeTranscript,
  transcribeAnswer,
  voiceReducer,
  VoiceState,
} from './voice-answer';
import { VoiceAnswerView } from '../components/interview/VoiceAnswer';

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('Voice answer state machine', () => {
  it('goes ready → requesting → recording → transcribing → transcript', () => {
    let s: VoiceState = { status: 'idle' };
    s = voiceReducer(s, { type: 'request' });
    assert.equal(s.status, 'requesting');
    s = voiceReducer(s, { type: 'started', at: 1000 });
    assert.deepEqual(s, { status: 'recording', startedAt: 1000 });
    s = voiceReducer(s, { type: 'stopped' });
    assert.equal(s.status, 'transcribing');
    assert.equal(voiceReducer(s, { type: 'transcribed', transcript: 'hi', autoInserted: true }).status, 'inserted');
    assert.deepEqual(voiceReducer(s, { type: 'transcribed', transcript: 'hi', autoInserted: false }), { status: 'review', transcript: 'hi' });
  });

  it('ignores a transcript that arrives after the recording was cancelled', () => {
    const s = voiceReducer({ status: 'idle' }, { type: 'transcribed', transcript: 'late', autoInserted: true });
    assert.deepEqual(s, { status: 'idle' });
  });

  it('recovers from permission and provider errors', () => {
    const denied = voiceReducer({ status: 'requesting' }, { type: 'failed', kind: 'permission', message: 'blocked' });
    assert.equal(denied.status, 'error');
    assert.equal(voiceReducer(denied, { type: 'request' }).status, 'requesting', 'can record again');
    assert.equal(voiceReducer(denied, { type: 'reset' }).status, 'idle');
  });
});

describe('Applying a transcript never loses typed text', () => {
  it('fills an empty, untouched editor automatically', () => {
    assert.equal(canAutoInsert('', ''), true);
  });

  it('asks instead when the editor had text or was edited during transcription', () => {
    assert.equal(canAutoInsert('My typed answer', 'My typed answer'), false);
    assert.equal(canAutoInsert('', 'typed while transcribing'), false, 'a newer typed draft is never overwritten');
  });

  it('appends or replaces only on request', () => {
    assert.equal(mergeTranscript('Typed part.', ' Spoken part. ', 'append'), 'Typed part.\n\nSpoken part.');
    assert.equal(mergeTranscript('Typed part.', 'Spoken part.', 'replace'), 'Spoken part.');
    assert.equal(mergeTranscript('   ', 'Spoken.', 'append'), 'Spoken.');
  });
});

describe('Recording format', () => {
  it('encodes 16 kHz mono 16-bit PCM WAV', () => {
    const buf = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1]), 16000);
    const view = new DataView(buf);
    const ascii = (o: number) => String.fromCharCode(...new Uint8Array(buf, o, 4));
    assert.equal(ascii(0), 'RIFF');
    assert.equal(ascii(8), 'WAVE');
    assert.equal(view.getUint16(20, true), 1);
    assert.equal(view.getUint16(22, true), 1);
    assert.equal(view.getUint32(24, true), 16000);
    assert.equal(view.getUint16(34, true), 16);
    assert.equal(view.getUint32(40, true), 10);
    assert.equal(view.getInt16(44 + 3 * 2, true), 32767);
  });

  it('downsamples 48 kHz to 16 kHz', () => {
    assert.equal(downsample(new Float32Array(48000), 48000).length, 16000);
    assert.equal(formatElapsed(65.9), '1:05');
  });
});

describe('Transcription request', () => {
  const audio = new Blob([new Uint8Array(10)], { type: 'audio/wav' });
  const args = { interviewId: 'iv 1', questionId: 'q1', audio };

  it('posts WAV for the current question and returns the transcript', async () => {
    let seen: [string, RequestInit] | null = null;
    const fetchFn = (async (url: string, init: RequestInit) => {
      seen = [url, init];
      return json(200, { transcript: 'Hello', durationSeconds: 2 });
    }) as unknown as typeof fetch;
    const result = await transcribeAnswer(args, { fetchFn, apiUrl: 'http://api' });
    assert.deepEqual(result, { ok: true, transcript: 'Hello', durationSeconds: 2 });
    assert.equal(seen![0], 'http://api/api/interviews/iv%201/transcribe?questionId=q1');
    assert.equal((seen![1].headers as Record<string, string>)['Content-Type'], 'audio/wav');
    assert.equal(seen![1].method, 'POST');
  });

  it('maps failures to recoverable messages', async () => {
    const respond = (status: number, body: unknown = {}) => ({ fetchFn: (async () => json(status, body)) as unknown as typeof fetch });
    assert.equal((await transcribeAnswer(args, respond(409))).ok, false);
    const closed = await transcribeAnswer(args, respond(409, { reason: 'TIME_EXPIRED' }));
    assert.equal(!closed.ok && closed.kind, 'closed');
    const silent = await transcribeAnswer(args, respond(422, { error: 'We couldn’t hear anything.' }));
    assert.deepEqual(silent, { ok: false, kind: 'audio', message: 'We couldn’t hear anything.' });
    const provider = await transcribeAnswer(args, respond(502, { error: 'Transcription is temporarily unavailable.' }));
    assert.equal(!provider.ok && provider.kind, 'provider');
    const offline = await transcribeAnswer(args, { fetchFn: (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch });
    assert.equal(!offline.ok && offline.kind, 'network');
  });
});

describe('Voice controls', () => {
  const view = (state: VoiceState, elapsedSeconds = 0) =>
    renderToStaticMarkup(
      React.createElement(VoiceAnswerView, { state, elapsedSeconds, onRecord: () => {}, onStop: () => {}, onApply: () => {}, onDismiss: () => {} })
    );

  it('shows each state with a clear label', () => {
    assert.match(view({ status: 'idle' }), /Record answer/);
    assert.match(view({ status: 'requesting' }), /Waiting for microphone permission/);
    const rec = view({ status: 'recording', startedAt: 0 }, 12);
    assert.match(rec, /Stop recording/);
    assert.match(rec, /0:12/);
    assert.match(view({ status: 'transcribing' }), /Transcribing your recording/);
    assert.match(view({ status: 'inserted' }), /Review and edit it, then submit/);
    const review = view({ status: 'review', transcript: 'Spoken answer' });
    assert.match(review, /Append to answer/);
    assert.match(review, /Replace answer/);
    assert.match(review, /Spoken answer/);
    const denied = view({ status: 'error', kind: 'permission', message: 'Microphone access was blocked.' });
    assert.match(denied, /role="alert"/);
    assert.match(denied, /Microphone access was blocked/);
    assert.match(denied, /Record again/);
  });

  it('never offers submission itself', () => {
    for (const s of [{ status: 'idle' }, { status: 'inserted' }, { status: 'review', transcript: 'x' }] as VoiceState[]) {
      assert.doesNotMatch(view(s), /Submit/);
    }
  });

  it('disables recording while saving or transcribing', () => {
    assert.match(view({ status: 'transcribing' }), /disabled/);
  });
});
