import { describe, it, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../../app.js';
import { db } from '../../prisma/db.js';
import { authService } from '../auth/auth.service.js';
import { interviewAccess } from '../auth/interview-access.js';
import {
  answerTranscriptionService,
  inspectWav,
  TRANSCRIBE_MAX_SECONDS,
  TranscriptionError,
} from './answer-transcription.service.js';
import { interviewLifecycle, InterviewClosedError } from './interview-lifecycle.service.js';
import { interviewService } from './interview.service.js';

/** 16-bit PCM WAV with a quiet sine tone (or silence). */
function wav({ seconds = 1, rate = 16000, channels = 1, bits = 16, silent = false } = {}): Buffer {
  const frames = Math.round(seconds * rate);
  const dataBytes = frames * channels * (bits / 8);
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * channels * (bits / 8), 28);
  buf.writeUInt16LE(channels * (bits / 8), 32);
  buf.writeUInt16LE(bits, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  if (!silent && bits === 16) {
    for (let i = 0; i < frames * channels; i++) buf.writeInt16LE(Math.round(Math.sin(i / 8) * 3000), 44 + i * 2);
  }
  return buf;
}

const ok = (text: string) => (async () => ({ text })) as any;

describe('WAV validation', () => {
  it('accepts 16-bit PCM and reports duration and level', () => {
    const info = inspectWav(wav({ seconds: 2 }));
    assert.strictEqual(info.sampleRate, 16000);
    assert.strictEqual(Math.round(info.durationSeconds), 2);
    assert.ok(info.peak > 1000);
  });

  it('rejects empty, malformed, non-WAV, unsupported and over-long recordings', () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return (e as TranscriptionError).code + ':' + (e as TranscriptionError).status;
      }
      return 'ok';
    };
    assert.strictEqual(code(() => inspectWav(Buffer.alloc(0))), 'INVALID_AUDIO:422');
    assert.strictEqual(code(() => inspectWav(Buffer.from('not audio at all, just some text bytes here...'))), 'INVALID_AUDIO:422');
    const noData = wav();
    noData.write('junk', 36, 'ascii');
    assert.strictEqual(code(() => inspectWav(noData)), 'INVALID_AUDIO:422');
    assert.strictEqual(code(() => inspectWav(wav({ bits: 8 }))), 'INVALID_AUDIO:422');
    assert.strictEqual(code(() => inspectWav(wav({ seconds: 0.2 }))), 'INVALID_AUDIO:422');
    assert.strictEqual(code(() => inspectWav(wav({ seconds: TRANSCRIBE_MAX_SECONDS + 5, rate: 8000 }))), 'TOO_LONG:413');
  });
});

describe('Answer transcription service', () => {
  const created: string[] = [];
  let interviewId = '';
  let theoryId = '';
  let codingId = '';

  before(async () => {
    const iv = await db.orm.public.Interview.create({ type: 'TECHNICAL', difficulty: 'MEDIUM', focusArea: 'transcription-test', questionCount: 2 } as any);
    created.push(iv.id);
    interviewId = iv.id;
    theoryId = (await db.orm.public.Question.create({ interviewId, questionText: 'What is ACID?', orderIndex: 1, type: 'THEORY' } as any)).id;
    codingId = (await db.orm.public.Question.create({ interviewId, questionText: 'Reverse a linked list', orderIndex: 2, type: 'CODING', codingProblemSlug: 'reverse-linked-list' } as any)).id;
  });
  after(async () => {
    for (const id of created) {
      await db.orm.public.Question.where({ interviewId: id }).deleteAll();
      await db.orm.public.Interview.where({ id }).deleteAll();
    }
  });
  beforeEach(() => mock.restoreAll());

  const req = (over: Record<string, unknown> = {}) => ({ interviewId, questionId: theoryId, audio: wav(), contentType: 'audio/wav', ...over }) as any;

  it('returns the transcript only: no answer saved, clock not started, nothing evaluated', async () => {
    const submit = mock.method(interviewService, 'submitAnswer', async () => {
      throw new Error('must not submit');
    });
    const generate = mock.fn(ok('  ACID stands for atomicity, consistency, isolation and durability.  '));
    const result = await answerTranscriptionService.transcribe(req(), { generate });

    assert.strictEqual(result.transcript, 'ACID stands for atomicity, consistency, isolation and durability.');
    assert.strictEqual(result.durationSeconds, 1);
    assert.strictEqual(submit.mock.callCount(), 0);
    const call = generate.mock.calls[0].arguments[0] as any;
    const audioPart = call.contents[0].parts[1];
    assert.strictEqual(audioPart.inlineData.mimeType, 'audio/wav');
    assert.strictEqual(call.config.tools, undefined, 'no tools or search are used');

    const answers = await db.orm.public.Answer.where({ questionId: theoryId }).all();
    assert.strictEqual(answers.length, 0);
    const iv = await db.orm.public.Interview.first({ id: interviewId });
    assert.strictEqual(iv!.startedAt, null);
    assert.strictEqual(iv!.status, 'NOT_STARTED');
    assert.strictEqual(await db.orm.public.EvaluationReport.where({ interviewId }).first(), null);
  });

  it('rejects unsupported types, silence and coding questions before calling the provider', async () => {
    const generate = mock.fn(ok('x'));
    const fail = async (r: any) => {
      try {
        await answerTranscriptionService.transcribe(r, { generate });
        return 'ok';
      } catch (e) {
        return `${(e as TranscriptionError).status}:${(e as TranscriptionError).code}`;
      }
    };
    assert.strictEqual(await fail(req({ contentType: 'audio/webm' })), '415:UNSUPPORTED_TYPE');
    assert.strictEqual(await fail(req({ audio: wav({ silent: true }) })), '422:SILENT');
    assert.strictEqual(await fail(req({ questionId: codingId })), '400:NOT_TEXT_QUESTION');
    assert.strictEqual(await fail(req({ questionId: '00000000-0000-4000-8000-000000000000' })), '404:NOT_FOUND');
    assert.strictEqual(generate.mock.callCount(), 0);
  });

  it('refuses a closed interview without calling the provider', async () => {
    mock.method(interviewLifecycle, 'assertOpen', async () => {
      throw new InterviewClosedError('TIME_EXPIRED');
    });
    const generate = mock.fn(ok('text'));
    await assert.rejects(() => answerTranscriptionService.transcribe(req(), { generate }), InterviewClosedError);
    assert.strictEqual(generate.mock.callCount(), 0);
  });

  it('withholds the transcript when the deadline passes during transcription', async () => {
    let checks = 0;
    mock.method(interviewLifecycle, 'assertOpen', async () => {
      checks += 1;
      if (checks > 1) throw new InterviewClosedError('TIME_EXPIRED');
    });
    await assert.rejects(() => answerTranscriptionService.transcribe(req(), { generate: ok('late transcript') }), InterviewClosedError);
    assert.strictEqual(checks, 2);
  });

  it('maps provider failures and empty results to recoverable errors', async () => {
    const failing = (async () => {
      throw new Error('quota exceeded for key AIza-secret');
    }) as any;
    await assert.rejects(
      () => answerTranscriptionService.transcribe(req(), { generate: failing }),
      (e: any) => e.status === 502 && e.code === 'PROVIDER_ERROR' && !/AIza/.test(e.message)
    );
    await assert.rejects(
      () => answerTranscriptionService.transcribe(req(), { generate: ok('   ') }),
      (e: any) => e.status === 422 && e.code === 'NO_SPEECH'
    );
  });
});

describe('POST /api/interviews/:id/transcribe', () => {
  const ALICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const IV = '11111111-1111-4111-8111-111111111111';
  const Q = '22222222-2222-4222-8222-222222222222';
  let server: Server;
  let base: string;
  before(() => {
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());
  beforeEach(() => {
    mock.restoreAll();
    mock.method(authService, 'resolveSession', async (token: string) =>
      token === 'alice' ? { userId: ALICE, sessionId: 's', name: 'A', email: 'a@example.com', role: 'USER' as const } : null);
  });

  const post = (opts: { user?: string; body?: Buffer; type?: string; questionId?: string } = {}) =>
    fetch(`${base}/api/interviews/${IV}/transcribe?questionId=${opts.questionId ?? Q}`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': opts.type ?? 'audio/wav',
        ...(opts.user ? { Cookie: `intervai_session=${opts.user}` } : {}),
      },
      body: new Uint8Array(opts.body ?? wav()),
    });

  it('requires a session and ownership of the interview', async () => {
    const transcribe = mock.method(answerTranscriptionService, 'transcribe', async () => ({ transcript: 'x', durationSeconds: 1 }));
    assert.strictEqual((await post()).status, 401);
    mock.method(interviewAccess, 'isOwnedBy', async () => false);
    assert.strictEqual((await post({ user: 'alice' })).status, 404);
    assert.strictEqual(transcribe.mock.callCount(), 0);
  });

  it('returns only the transcript and duration for the owner', async () => {
    mock.method(interviewAccess, 'isOwnedBy', async () => true);
    const transcribe = mock.method(answerTranscriptionService, 'transcribe', async () => ({ transcript: 'Hello there', durationSeconds: 1.2 }));
    const res = await post({ user: 'alice' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { transcript: 'Hello there', durationSeconds: 1.2 });
    const args = transcribe.mock.calls[0].arguments[0] as any;
    assert.strictEqual(args.interviewId, IV);
    assert.strictEqual(args.questionId, Q);
    assert.ok(Buffer.isBuffer(args.audio));
  });

  it('rejects missing question ids, other content types and closed interviews', async () => {
    mock.method(interviewAccess, 'isOwnedBy', async () => true);
    assert.strictEqual((await post({ user: 'alice', questionId: 'nope' })).status, 400);
    assert.strictEqual((await post({ user: 'alice', type: 'application/octet-stream' })).status, 415);
    mock.method(answerTranscriptionService, 'transcribe', async () => {
      throw new InterviewClosedError('TIME_EXPIRED');
    });
    const closed = await post({ user: 'alice' });
    assert.strictEqual(closed.status, 409);
    assert.strictEqual((await closed.json()).reason, 'TIME_EXPIRED');
  });

  it('rejects uploads over the size limit', async () => {
    mock.method(interviewAccess, 'isOwnedBy', async () => true);
    const transcribe = mock.method(answerTranscriptionService, 'transcribe', async () => ({ transcript: 'x', durationSeconds: 1 }));
    const res = await post({ user: 'alice', body: Buffer.alloc(9 * 1024 * 1024) });
    assert.strictEqual(res.status, 413);
    assert.strictEqual(transcribe.mock.callCount(), 0);
  });
});
