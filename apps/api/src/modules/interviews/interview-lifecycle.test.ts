/**
 * Interview clock and expiry. These rules live in SQL conditional updates, so
 * the tests run against the local Postgres (no AI or external services):
 * single-connection cases run inside a transaction that is always rolled back;
 * the concurrency cases use committed disposable rows that are deleted afterwards.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { db } from '../../prisma/db.js';
import { instantFromMs } from '../auth/auth.time.js';
import { InterviewClosedError, interviewLifecycle, isValidDuration } from './interview-lifecycle.service.js';
import { interviewService } from './interview.service.js';

const ROLLBACK = new Error('rollback');

/** Runs `fn` in a transaction that is always rolled back. */
const inRollback = async (fn: (tx: any) => Promise<void>) => {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
};

const createInterview = (orm: any, overrides: Record<string, unknown> = {}) =>
  orm.orm.public.Interview.create({
    type: 'HR',
    difficulty: 'EASY',
    focusArea: 'lifecycle-test',
    questionCount: 1,
    ...overrides,
  });

describe('Interview duration options', () => {
  it('accepts only the offered durations', () => {
    assert.ok(isValidDuration(15) && isValidDuration(60));
    assert.ok(!isValidDuration(20) && !isValidDuration('30') && !isValidDuration(null));
  });
});

describe('Interview clock (rolled-back transactions)', () => {
  it('sets the deadline once, from the server clock, when the interview starts', async () => {
    await inRollback(async (tx) => {
      const iv = await createInterview(tx, { durationMinutes: 30 });
      assert.strictEqual(iv.deadlineAt ?? null, null, 'no deadline before the interview begins');

      const before = Date.now();
      const first = await interviewLifecycle.start(iv.id, tx);
      const deadline = Date.parse(first!.deadlineAt!);
      const started = Date.parse(first!.startedAt!);
      assert.strictEqual(deadline - started, 30 * 60_000);
      assert.ok(started >= before - 1000);
      assert.strictEqual(first!.status, 'IN_PROGRESS');

      // Refresh / resume / second tab: same values, never restarted.
      const again = await interviewLifecycle.start(iv.id, tx);
      assert.strictEqual(again!.startedAt, first!.startedAt);
      assert.strictEqual(again!.deadlineAt, first!.deadlineAt);
    });
  });

  it('leaves untimed and legacy interviews without a deadline, so they never expire', async () => {
    await inRollback(async (tx) => {
      const iv = await createInterview(tx);
      const timing = await interviewLifecycle.start(iv.id, tx);
      assert.strictEqual(timing!.deadlineAt, null);
      assert.strictEqual(await interviewLifecycle.expireIfDue(iv.id, tx), false);
      await interviewLifecycle.lockOpenForSubmission(tx, iv.id); // still open
    });
  });

  it('does not expire before the deadline and expires exactly once after it', async () => {
    await inRollback(async (tx) => {
      const iv = await createInterview(tx, { durationMinutes: 15 });
      await interviewLifecycle.start(iv.id, tx);
      assert.strictEqual(await interviewLifecycle.expireIfDue(iv.id, tx), false);

      await tx.orm.public.Interview.where({ id: iv.id }).update({ deadlineAt: instantFromMs(Date.now() - 1000) });
      assert.strictEqual(await interviewLifecycle.expireIfDue(iv.id, tx), true);
      assert.strictEqual(await interviewLifecycle.expireIfDue(iv.id, tx), false, 'second call is a no-op');

      const row = await tx.orm.public.Interview.first({ id: iv.id });
      assert.strictEqual(row.status, 'COMPLETED');
      assert.strictEqual(row.completionReason, 'TIME_EXPIRED');
      assert.ok(row.completedAt);
    });
  });

  it('refuses submissions after the deadline even before anything finalized the interview', async () => {
    await inRollback(async (tx) => {
      const iv = await createInterview(tx, { durationMinutes: 15 });
      await interviewLifecycle.start(iv.id, tx);
      await tx.orm.public.Interview.where({ id: iv.id }).update({ deadlineAt: instantFromMs(Date.now() - 1) });
      await assert.rejects(
        () => interviewLifecycle.lockOpenForSubmission(tx, iv.id),
        (err: any) => err instanceof InterviewClosedError && err.reason === 'TIME_EXPIRED' && err.code === 'CONFLICT'
      );
    });
  });

  it('does not overwrite an interview already completed by answering everything', async () => {
    await inRollback(async (tx) => {
      const iv = await createInterview(tx, { durationMinutes: 15 });
      await interviewLifecycle.start(iv.id, tx);
      await interviewLifecycle.markAllAnswered(tx, iv.id);
      await tx.orm.public.Interview.where({ id: iv.id }).update({ deadlineAt: instantFromMs(Date.now() - 1) });
      assert.strictEqual(await interviewLifecycle.expireIfDue(iv.id, tx), false);
      const row = await tx.orm.public.Interview.first({ id: iv.id });
      assert.strictEqual(row.completionReason, 'ALL_ANSWERED');
    });
  });
});

describe('Interview clock races (committed disposable rows)', () => {
  const created: string[] = [];
  after(async () => {
    for (const id of created) {
      await db.orm.public.Question.where({ interviewId: id }).deleteAll();
      await db.orm.public.Interview.where({ id }).deleteAll();
    }
  });

  it('expires exactly once when many requests race past the deadline', async () => {
    const iv = await createInterview(db, { durationMinutes: 15 });
    created.push(iv.id);
    await interviewLifecycle.start(iv.id);
    await db.orm.public.Interview.where({ id: iv.id }).update({ deadlineAt: instantFromMs(Date.now() - 1) });

    const results = await Promise.all(Array.from({ length: 8 }, () => interviewLifecycle.expireIfDue(iv.id)));
    assert.strictEqual(results.filter(Boolean).length, 1);
  });

  it('serializes a submission and an expiry: the answer is either saved before expiry or refused', async () => {
    const iv = await createInterview(db, { durationMinutes: 15 });
    created.push(iv.id);
    await interviewLifecycle.start(iv.id);
    const question = await db.orm.public.Question.create({ interviewId: iv.id, questionText: 'Q', orderIndex: 1 });
    // Deadline lands while the submission transaction holds the row lock.
    await db.orm.public.Interview.where({ id: iv.id }).update({ deadlineAt: instantFromMs(Date.now() + 300) });

    let submissionOutcome = 'pending';
    const submission = db.transaction(async (tx) => {
      await interviewLifecycle.lockOpenForSubmission(tx, iv.id);
      await new Promise((r) => setTimeout(r, 600)); // still holding the lock past the deadline
      await tx.orm.public.Answer.create({ questionId: question.id, answerText: 'in time' });
    }).then(() => { submissionOutcome = 'saved'; }, () => { submissionOutcome = 'refused'; });

    await new Promise((r) => setTimeout(r, 400)); // now past the deadline
    const expired = await interviewLifecycle.expireIfDue(iv.id); // waits for the submission's lock
    await submission;

    assert.strictEqual(submissionOutcome, 'saved', 'a submission that began before the deadline completes');
    assert.strictEqual(expired, true);
    const answers = await db.orm.public.Answer.where({ questionId: question.id }).all();
    assert.strictEqual(answers.length, 1, 'the in-time answer is kept for the report');
    await db.orm.public.Answer.where({ questionId: question.id }).deleteAll();

    await assert.rejects(() => interviewService.submitAnswer(iv.id, question.id, 'too late'), InterviewClosedError);
  });
});
