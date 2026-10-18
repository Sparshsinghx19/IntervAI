import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { classifyNewQuestion, codeExecutionEnabled, effectiveQuestionType } from '../coding/coding-problems.catalog.js';
import { CodingService } from '../coding/coding.service.js';
import { RunnerUnavailableError } from '../coding/judge0.service.js';
import { healthService } from './health.service.js';

const reverse = { type: 'CODING', questionText: 'Reverse a linked list', codingProblemSlug: 'reverse-linked-list' };

describe('Code execution switch', () => {
  const original = process.env.CODE_EXECUTION_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.CODE_EXECUTION_ENABLED;
    else process.env.CODE_EXECUTION_ENABLED = original;
    mock.restoreAll();
  });

  it('is on unless explicitly switched off', () => {
    assert.strictEqual(codeExecutionEnabled({}), true);
    assert.strictEqual(codeExecutionEnabled({ CODE_EXECUTION_ENABLED: 'true' }), true);
    assert.strictEqual(codeExecutionEnabled({ CODE_EXECUTION_ENABLED: ' FALSE ' }), false);
  });

  it('answers coding questions in text while off, without changing what is stored', () => {
    process.env.CODE_EXECUTION_ENABLED = 'false';
    assert.strictEqual(effectiveQuestionType(reverse), 'THEORY');
    assert.deepStrictEqual(classifyNewQuestion(reverse), { type: 'CODING', codingProblemSlug: 'reverse-linked-list' });
    delete process.env.CODE_EXECUTION_ENABLED;
    assert.strictEqual(effectiveQuestionType(reverse), 'CODING', 'switching back on restores the IDE');
  });

  it('never reaches the runner while off', async () => {
    process.env.CODE_EXECUTION_ENABLED = 'false';
    const runner = { executeBatch: mock.fn(async () => { throw new Error('runner must not be called'); }) } as any;
    const service = new CodingService(runner);
    const opts = { interviewId: 'i', questionId: 'q', language: 'python' as const, sourceCode: 'print(1)' };
    await assert.rejects(() => service.runCode(opts), RunnerUnavailableError);
    await assert.rejects(() => service.submitSolution(opts), RunnerUnavailableError);
    assert.strictEqual(runner.executeBatch.mock.callCount(), 0);
  });
});

describe('Readiness check', () => {
  it('reports database reachability without details', async () => {
    assert.deepStrictEqual(await healthService.checkReady(async () => undefined), { status: 'ok', database: 'ok', codeExecution: 'enabled' });
    const down = await healthService.checkReady(async () => {
      throw new Error('connect ECONNREFUSED postgres://user:secret@db:5432');
    });
    assert.strictEqual(down.status, 'degraded');
    assert.strictEqual(down.database, 'unavailable');
    assert.doesNotMatch(JSON.stringify(down), /secret|ECONNREFUSED/);
  });

  it('checks the real database', async () => {
    assert.strictEqual((await healthService.checkReady()).database, 'ok');
  });
});
