import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  fetchCodingProblem,
  runCode,
  submitCode,
  formatSafeRunnerErrorMessage,
} from './coding-api';

describe('Coding API Client & Runner Error Formatting (Frontend)', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('fetchCodingProblem successfully retrieves public problem data', async () => {
    const mockProblem = {
      slug: 'valid-palindrome',
      title: 'Valid Palindrome',
      difficulty: 'EASY',
      description: 'Given a string...',
      examples: [
        { input: 'racecar', output: 'true' },
      ],
      starterCode: {
        cpp: '// cpp',
        python: '# py',
        java: '// java',
      },
      hasHiddenTests: true,
    };

    mock.method(global, 'fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        supported: true,
        problem: mockProblem,
      }),
    } as any));

    const result = await fetchCodingProblem({
      interviewId: 'int-123',
      questionId: 'q-456',
      apiUrl: 'http://localhost:4000',
    });

    assert.strictEqual(result.supported, true);
    assert.strictEqual(result.problem?.slug, 'valid-palindrome');
    assert.strictEqual(result.problem?.hasHiddenTests, true);
    assert.strictEqual(result.problem?.examples.length, 1);
  });

  it('fetchCodingProblem safely formats 404 or unsupported problem error', async () => {
    mock.method(global, 'fetch', async () => ({
      ok: false,
      status: 404,
      json: async () => ({
        error: 'Coding problem metadata is not configured for this question.',
      }),
    } as any));

    const result = await fetchCodingProblem({
      interviewId: 'int-123',
      questionId: 'q-theory',
      apiUrl: 'http://localhost:4000',
    });

    assert.strictEqual(result.supported, false);
    assert.strictEqual(result.error, 'Coding problem metadata is not configured for this question.');
  });

  it('runCode executes public cases and returns sample test results', async () => {
    const mockRunResponse = {
      overallStatus: 'Accepted',
      testsPassed: 3,
      totalTests: 3,
      results: [
        { label: 'Example 1', passed: true, status: 'Accepted', input: 'racecar', expectedOutput: 'true', actualOutput: 'true\n' },
      ],
    };

    mock.method(global, 'fetch', async (url: string, opts?: any) => {
      assert.ok(url.endsWith('/code/run'));
      assert.strictEqual(opts?.method, 'POST');
      const body = JSON.parse(opts.body);
      assert.strictEqual(body.language, 'python');
      assert.strictEqual(body.sourceCode, 'print("true")');
      return {
        ok: true,
        status: 200,
        json: async () => mockRunResponse,
      } as any;
    });

    const result = await runCode({
      interviewId: 'int-123',
      questionId: 'q-456',
      language: 'python',
      sourceCode: 'print("true")',
      apiUrl: 'http://localhost:4000',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.overallStatus, 'Accepted');
    assert.strictEqual(result.result?.testsPassed, 3);
  });

  it('submitCode executes both public & hidden tests and returns sanitized hidden results', async () => {
    const mockSubmitResponse = {
      submissionId: 'sub-uuid-789',
      status: 'Accepted',
      testsPassed: 5,
      totalTests: 5,
      publicResults: [
        { label: 'Example 1', passed: true, status: 'Accepted', input: 'racecar', expectedOutput: 'true', actualOutput: 'true\n' },
      ],
      hiddenResults: [
        { label: 'Hidden Test 1', passed: true, status: 'Accepted', executionTimeMs: 35, memoryKb: 12800 },
        { label: 'Hidden Test 2', passed: true, status: 'Accepted', executionTimeMs: 40, memoryKb: 13000 },
      ],
      sourceCode: 'print("true")',
      language: 'python',
    };

    mock.method(global, 'fetch', async (url: string, opts?: any) => {
      assert.ok(url.endsWith('/code/submit'));
      assert.strictEqual(opts?.method, 'POST');
      return {
        ok: true,
        status: 201,
        json: async () => mockSubmitResponse,
      } as any;
    });

    const result = await submitCode({
      interviewId: 'int-123',
      questionId: 'q-456',
      language: 'python',
      sourceCode: 'print("true")',
      apiUrl: 'http://localhost:4000',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.submissionId, 'sub-uuid-789');
    assert.strictEqual(result.result?.testsPassed, 5);
    assert.strictEqual(result.result?.hiddenResults.length, 2);
    assert.strictEqual(result.result?.hiddenResults[0].label, 'Hidden Test 1');

    // Confirm hidden results have no leaked input or expected output
    const hResult = result.result?.hiddenResults[0] as any;
    assert.strictEqual(hResult.input, undefined);
    assert.strictEqual(hResult.expectedOutput, undefined);
  });

  it('formatSafeRunnerErrorMessage correctly maps connection refused, 503 unavailable, and queue saturation', () => {
    const connRefused = formatSafeRunnerErrorMessage(new Error('connect ECONNREFUSED 127.0.0.1:4000'));
    assert.ok(connRefused.includes('Unable to connect to the execution runner service'));

    const unavail = formatSafeRunnerErrorMessage('Code execution runner is currently unavailable.');
    assert.ok(unavail.includes('currently unavailable'));

    const queueBusy = formatSafeRunnerErrorMessage('Runner queue is at capacity (429)');
    assert.ok(queueBusy.includes('queue is currently busy'));

    const generic = formatSafeRunnerErrorMessage('Compilation Error');
    assert.strictEqual(generic, 'Compilation Error');
  });
});
