import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Judge0Service, RunnerUnavailableError } from './judge0.service.js';
import { CodingService } from './coding.service.js';
import { HiddenTestLoader } from './hidden-test-loader.js';
import { CODING_PROBLEMS_CATALOG, findCodingProblemForQuestion } from './coding-problems.catalog.js';
import { buildExecutionHarness } from './coding-harness.js';
import { db } from '../../prisma/db.js';
import { evaluationService } from '../evaluations/evaluation.service.js';
import { aiEvaluatorService } from '../evaluations/ai-evaluator.service.js';

describe('Coding Execution Engine & Judge0 Runner', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  // Mock Language catalog returned by Judge0
  const mockLanguages = [
    { id: 54, name: 'C++ (GCC 9.2.0)' },
    { id: 71, name: 'Python (3.8.1)' },
    { id: 62, name: 'Java (OpenJDK 13.0.1)' },
    { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
  ];

  it('resolves C++, Python, and Java language IDs dynamically from Judge0 /languages and caches them', async () => {
    let fetchCount = 0;
    const mockFetch = (async (url: string) => {
      if (url.endsWith('/languages')) {
        fetchCount++;
        return {
          ok: true,
          status: 200,
          json: async () => mockLanguages,
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as any;

    const runner = new Judge0Service({
      baseUrl: 'http://localhost:2358',
      fetch: mockFetch,
    });

    const cppId = await runner.resolveLanguageId('cpp');
    const pyId = await runner.resolveLanguageId('python');
    const javaId = await runner.resolveLanguageId('java');

    assert.strictEqual(cppId, 54);
    assert.strictEqual(pyId, 71);
    assert.strictEqual(javaId, 62);
    assert.strictEqual(fetchCount, 1, 'Languages endpoint should be called only once and cached');

    // Subsequent resolution uses memory cache
    const cppIdAgain = await runner.resolveLanguageId('cpp');
    assert.strictEqual(cppIdAgain, 54);
    assert.strictEqual(fetchCount, 1, 'Memory cache prevented second fetch');
  });

  it('submits batch test cases asynchronously with base64 encoding and polls until terminal state', async () => {
    let postReceived = false;
    let pollCount = 0;

    const mockFetch = (async (url: string, opts?: any) => {
      if (url.endsWith('/languages')) {
        return { ok: true, status: 200, json: async () => mockLanguages } as any;
      }

      if (url.includes('/submissions/batch?base64_encoded=true') && opts?.method === 'POST') {
        postReceived = true;
        const parsed = JSON.parse(opts.body);
        assert.strictEqual(parsed.submissions.length, 2);
        assert.ok(parsed.submissions[0].source_code);
        assert.strictEqual(parsed.submissions[0].language_id, 71);
        return {
          ok: true,
          status: 201,
          json: async () => [{ token: 'tok-1' }, { token: 'tok-2' }],
        } as any;
      }

      if (url.includes('/submissions/batch?tokens=tok-1,tok-2')) {
        pollCount++;
        if (pollCount === 1) {
          // In queue
          return {
            ok: true,
            status: 200,
            json: async () => [
              { token: 'tok-1', status_id: 1, status: { id: 1, description: 'In Queue' } },
              { token: 'tok-2', status_id: 2, status: { id: 2, description: 'Processing' } },
            ],
          } as any;
        }

        // Terminal state reached
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              token: 'tok-1',
              status_id: 3,
              status: { id: 3, description: 'Accepted' },
              stdout: Buffer.from('true\n').toString('base64'),
              time: '0.045',
              memory: 14200,
            },
            {
              token: 'tok-2',
              status_id: 3,
              status: { id: 3, description: 'Accepted' },
              stdout: Buffer.from('false\n').toString('base64'),
              time: '0.038',
              memory: 13900,
            },
          ],
        } as any;
      }

      throw new Error(`Unexpected request: ${url}`);
    }) as any;

    const runner = new Judge0Service({ baseUrl: 'http://localhost:2358', fetch: mockFetch });
    const result = await runner.executeBatch({
      language: 'python',
      sourceCode: 'import sys\nprint("true")',
      testCases: [
        { input: 'racecar', expectedOutput: 'true' },
        { input: 'hello', expectedOutput: 'false' },
      ],
    });

    assert.strictEqual(postReceived, true);
    assert.strictEqual(pollCount, 2);
    assert.strictEqual(result.overallStatus, 'Accepted');
    assert.strictEqual(result.testsPassed, 2);
    assert.strictEqual(result.totalTests, 2);
    assert.strictEqual(result.results[0].passed, true);
    assert.strictEqual(result.results[0].executionTimeMs, 45);
    assert.strictEqual(result.results[0].memoryKb, 14200);
  });

  it('normalizes output differences so trailing newlines and carriage returns do not produce false failures', async () => {
    const mockFetch = (async (url: string, opts?: any) => {
      if (url.endsWith('/languages')) {
        return { ok: true, status: 200, json: async () => mockLanguages } as any;
      }
      if (opts?.method === 'POST') {
        return { ok: true, status: 201, json: async () => [{ token: 'tok-1' }] } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            token: 'tok-1',
            status_id: 3,
            status: { id: 3, description: 'Accepted' },
            stdout: Buffer.from('true  \r\n\r\n').toString('base64'), // Windows CRLF + trailing space + blank lines
          },
        ],
      } as any;
    }) as any;

    const runner = new Judge0Service({ baseUrl: 'http://localhost:2358', fetch: mockFetch });
    const result = await runner.executeBatch({
      language: 'python',
      sourceCode: 'print("true")',
      testCases: [{ input: 'racecar', expectedOutput: 'true\n' }],
    });

    assert.strictEqual(result.overallStatus, 'Accepted');
    assert.strictEqual(result.results[0].passed, true);
  });

  it('detects Wrong Answer when normalized output differs from expected output', async () => {
    const mockFetch = (async (url: string, opts?: any) => {
      if (url.endsWith('/languages')) {
        return { ok: true, status: 200, json: async () => mockLanguages } as any;
      }
      if (opts?.method === 'POST') {
        return { ok: true, status: 201, json: async () => [{ token: 'tok-1' }] } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            token: 'tok-1',
            status_id: 3,
            status: { id: 3, description: 'Accepted' },
            stdout: Buffer.from('false\n').toString('base64'),
          },
        ],
      } as any;
    }) as any;

    const runner = new Judge0Service({ baseUrl: 'http://localhost:2358', fetch: mockFetch });
    const result = await runner.executeBatch({
      language: 'cpp',
      sourceCode: 'int main() {}',
      testCases: [{ input: 'racecar', expectedOutput: 'true' }],
    });

    assert.strictEqual(result.overallStatus, 'Wrong Answer');
    assert.strictEqual(result.results[0].passed, false);
    assert.strictEqual(result.results[0].status, 'Wrong Answer');
    assert.strictEqual(result.testsPassed, 0);
  });

  it('correctly handles compilation errors, runtime errors, and time limit exceeded', async () => {
    const mockFetch = (async (url: string, opts?: any) => {
      if (url.endsWith('/languages')) {
        return { ok: true, status: 200, json: async () => mockLanguages } as any;
      }
      if (opts?.method === 'POST') {
        return { ok: true, status: 201, json: async () => [{ token: 'tok-1' }, { token: 'tok-2' }, { token: 'tok-3' }] } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            token: 'tok-1',
            status_id: 6,
            status: { id: 6, description: 'Compilation Error' },
            compile_output: Buffer.from('SyntaxError: unexpected EOF\n').toString('base64'),
          },
          {
            token: 'tok-2',
            status_id: 11,
            status: { id: 11, description: 'Runtime Error (NZEC)' },
            stderr: Buffer.from('ZeroDivisionError: division by zero\n').toString('base64'),
          },
          {
            token: 'tok-3',
            status_id: 5,
            status: { id: 5, description: 'Time Limit Exceeded' },
          },
        ],
      } as any;
    }) as any;

    const runner = new Judge0Service({ baseUrl: 'http://localhost:2358', fetch: mockFetch });
    const result = await runner.executeBatch({
      language: 'python',
      sourceCode: 'broken code',
      testCases: [
        { input: '1', expectedOutput: '1' },
        { input: '2', expectedOutput: '2' },
        { input: '3', expectedOutput: '3' },
      ],
    });

    assert.strictEqual(result.overallStatus, 'Compilation Error');
    assert.strictEqual(result.results[0].status, 'Compilation Error');
    assert.strictEqual(result.results[0].compileOutput, 'SyntaxError: unexpected EOF\n');
    assert.strictEqual(result.results[1].status, 'Runtime Error');
    assert.strictEqual(result.results[2].status, 'Time Limit Exceeded');
  });

  it('handles runner offline, 429 queue capacity, and returns typed RunnerUnavailableError', async () => {
    const mockFetchUnavailable = (async () => {
      const err = new Error('connect ECONNREFUSED 127.0.0.1:2358');
      (err as any).code = 'ECONNREFUSED';
      throw err;
    }) as any;

    const runner = new Judge0Service({ baseUrl: 'http://localhost:2358', fetch: mockFetchUnavailable });

    await assert.rejects(
      async () => {
        await runner.resolveLanguageId('python');
      },
      (err: any) => {
        assert.ok(err instanceof RunnerUnavailableError);
        assert.ok(err.message.includes('Unable to connect'));
        return true;
      }
    );

    const mockFetchQueueFull = (async (url: string, opts?: any) => {
      if (url.endsWith('/languages')) {
        return { ok: true, status: 200, json: async () => mockLanguages } as any;
      }
      return { ok: false, status: 429 } as any;
    }) as any;

    const busyRunner = new Judge0Service({ baseUrl: 'http://localhost:2358', fetch: mockFetchQueueFull });
    await assert.rejects(
      async () => {
        await busyRunner.executeBatch({
          language: 'python',
          sourceCode: 'print(1)',
          testCases: [{ input: '1', expectedOutput: '1' }],
        });
      },
      (err: any) => {
        assert.ok(err instanceof RunnerUnavailableError);
        assert.ok(err.message.includes('capacity') || err.message.includes('queue'));
        return true;
      }
    );
  });

  it('getCodingProblem returns public metadata and never returns hidden test inputs/outputs', async () => {
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => ({
        id: 'q-coding-1',
        interviewId: 'int-1',
        type: 'CODING',
        codingProblemSlug: 'valid-palindrome',
        questionText: 'Given a string s, return true if it is a palindrome...',
      }),
    }));

    const mockLoader = {
      hasHiddenTests: async () => true,
      getHiddenTestCases: async () => [
        { id: 'h1', problemSlug: 'valid-palindrome', input: 'PRIVATE_INPUT', expectedOutput: 'PRIVATE_OUTPUT' },
      ],
    } as any;

    const codingSvc = new CodingService(new Judge0Service(), mockLoader);
    const result = await codingSvc.getCodingProblem('int-1', 'q-coding-1');

    assert.strictEqual(result.supported, true);
    assert.strictEqual(result.problem?.slug, 'valid-palindrome');
    assert.strictEqual(result.problem?.hasHiddenTests, true);
    assert.ok(result.problem?.examples.length === 3);

    const jsonString = JSON.stringify(result);
    assert.ok(!jsonString.includes('PRIVATE_INPUT'), 'Public endpoint must never leak hidden test input');
    assert.ok(!jsonString.includes('PRIVATE_OUTPUT'), 'Public endpoint must never leak hidden expected output');
  });

  it('runCode executes public examples without creating a CodeSubmission in the database', async () => {
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => ({
        id: 'q-coding-1',
        interviewId: 'int-1',
        type: 'CODING',
        codingProblemSlug: 'valid-palindrome',
      }),
    }));

    let codeSubmissionCreated = false;
    mock.method(db.orm.public.CodeSubmission, 'create', async () => {
      codeSubmissionCreated = true;
      return {} as any;
    });

    const mockRunner = {
      executeBatch: async () => ({
        overallStatus: 'Accepted',
        testsPassed: 3,
        totalTests: 3,
        results: [
          { testIndex: 0, passed: true, status: 'Accepted', actualOutput: 'true\n' },
          { testIndex: 1, passed: true, status: 'Accepted', actualOutput: 'false\n' },
          { testIndex: 2, passed: true, status: 'Accepted', actualOutput: 'true\n' },
        ],
      }),
    } as any;

    const codingSvc = new CodingService(mockRunner, new HiddenTestLoader());
    const res = await codingSvc.runCode({
      interviewId: 'int-1',
      questionId: 'q-coding-1',
      language: 'python',
      sourceCode: 'def solve(): pass',
    });

    assert.strictEqual(res.overallStatus, 'Accepted');
    assert.strictEqual(res.testsPassed, 3);
    assert.strictEqual(codeSubmissionCreated, false, 'Run Code must NEVER create a CodeSubmission record');
  });

  it('submitSolution executes both public & hidden tests, sanitizes hidden test cards, and persists CodeSubmission', async () => {
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => ({
        id: 'q-coding-1',
        interviewId: 'int-1',
        type: 'CODING',
        codingProblemSlug: 'valid-palindrome',
      }),
      all: async () => [
        { id: 'q-coding-1', type: 'CODING' },
      ],
    }));

    mock.method(db.orm.public.Interview, 'where', () => ({
      first: async () => ({
        id: 'int-1',
        questionCount: 1,
        status: 'IN_PROGRESS',
      }),
      update: async () => ({}),
    }));

    mock.method(db.orm.public.CodeSubmission, 'where', () => ({
      all: async () => [{ id: 'sub-1', questionId: 'q-coding-1' }],
    }));

    let persistedSubmission: any = null;
    mock.method(db.orm.public.CodeSubmission, 'create', async (data: any) => {
      persistedSubmission = { id: 'sub-uuid-1234', ...data };
      return persistedSubmission;
    });

    mock.method(db, 'transaction', async (cb: any) => {
      const fakeTx = {
        orm: {
          public: {
            CodeSubmission: {
              create: async (data: any) => {
                persistedSubmission = { id: 'sub-uuid-1234', ...data };
                return persistedSubmission;
              },
              where: () => ({ all: async () => [{ id: 'sub-uuid-1234', questionId: 'q-coding-1' }] }),
            },
            Interview: {
              where: () => ({
                first: async () => ({ id: 'int-1', questionCount: 1, status: 'IN_PROGRESS' }),
                update: async () => ({}),
              }),
            },
            Question: {
              where: () => ({ all: async () => [{ id: 'q-coding-1', type: 'CODING' }] }),
            },
            Answer: {
              where: () => ({ aggregate: async () => ({ count: 0 }) }),
            },
          },
        },
      };
      return await cb(fakeTx);
    });

    const mockLoader = {
      getHiddenTestCases: async () => [
        { id: 'h-1', problemSlug: 'valid-palindrome', input: 'SECRET_HIDDEN_IN', expectedOutput: 'SECRET_HIDDEN_OUT' },
      ],
    } as any;

    const mockRunner = {
      executeBatch: async (opts: any) => {
        assert.strictEqual(opts.testCases.length, 4, 'Should execute 3 public examples + 1 hidden test');
        return {
          overallStatus: 'Accepted',
          testsPassed: 4,
          totalTests: 4,
          results: [
            { testIndex: 0, passed: true, status: 'Accepted', actualOutput: 'true\n' },
            { testIndex: 1, passed: true, status: 'Accepted', actualOutput: 'false\n' },
            { testIndex: 2, passed: true, status: 'Accepted', actualOutput: 'true\n' },
            { testIndex: 3, passed: true, status: 'Accepted', actualOutput: 'SECRET_HIDDEN_OUT\n' },
          ],
        };
      },
    } as any;

    const codingSvc = new CodingService(mockRunner, mockLoader);
    const submitRes = await codingSvc.submitSolution({
      interviewId: 'int-1',
      questionId: 'q-coding-1',
      language: 'cpp',
      sourceCode: '#include <iostream>',
    });

    assert.strictEqual(submitRes.submissionId, 'sub-uuid-1234');
    assert.strictEqual(submitRes.status, 'Accepted');
    assert.strictEqual(submitRes.testsPassed, 4);
    assert.strictEqual(submitRes.totalTests, 4);
    assert.strictEqual(submitRes.publicResults.length, 3);
    assert.strictEqual(submitRes.hiddenResults.length, 1);
    assert.strictEqual(submitRes.hiddenResults[0].label, 'Hidden Test 1');
    assert.strictEqual(submitRes.hiddenResults[0].passed, true);

    // Verify hidden tests response sanitization
    const resJson = JSON.stringify(submitRes);
    assert.ok(!resJson.includes('SECRET_HIDDEN_IN'), 'submitSolution must NOT leak hidden test inputs');
    assert.ok(!resJson.includes('SECRET_HIDDEN_OUT'), 'submitSolution must NOT leak hidden expected or actual outputs');
  });

  it('rejects coding requests for non-CODING questions', async () => {
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => ({
        id: 'q-theory-1',
        interviewId: 'int-1',
        type: 'THEORY',
      }),
    }));

    const codingSvc = new CodingService(new Judge0Service(), new HiddenTestLoader());

    await assert.rejects(
      async () => {
        await codingSvc.getCodingProblem('int-1', 'q-theory-1');
      },
      (err: any) => {
        assert.strictEqual(err.code, 'BAD_REQUEST');
        assert.ok(err.message.includes('not a coding question'));
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await codingSvc.runCode({
          interviewId: 'int-1',
          questionId: 'q-theory-1',
          language: 'python',
          sourceCode: 'print(1)',
        });
      },
      (err: any) => {
        assert.strictEqual(err.code, 'BAD_REQUEST');
        return true;
      }
    );
  });

  it('generates final consolidated report for coding-only interview with ZERO Gemini calls', async () => {
    const interviewId = 'int-coding-only-1';

    mock.method(db.orm.public.Interview, 'first', async () => ({
      id: interviewId,
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      focusArea: 'DSA',
      questionCount: 1,
      status: 'COMPLETED',
    }));

    mock.method(db.orm.public.Question, 'where', () => ({
      all: async () => [
        {
          id: 'q-coding-1',
          interviewId,
          orderIndex: 1,
          type: 'CODING',
          questionText: 'Reverse a singly linked list.',
        },
      ],
    }));

    mock.method(db.orm.public.Answer, 'where', () => ({
      all: async () => [],
    }));

    mock.method(db.orm.public.CodeSubmission, 'where', () => ({
      all: async () => [
        {
          id: 'sub-1',
          interviewId,
          questionId: 'q-coding-1',
          language: 'python',
          sourceCode: 'class Solution: pass',
          status: 'Accepted',
          testsPassed: 5,
          totalTests: 5,
          executionTimeMs: 42,
          memoryKb: 13500,
          createdAt: new Date(),
        },
      ],
    }));

    let geminiInvoked = false;
    mock.method(aiEvaluatorService, 'evaluateBatch', async () => {
      geminiInvoked = true;
      throw new Error('Gemini must NOT be called for coding-only interviews');
    });

    let savedReportPayload: any = null;
    let txCount = 0;
    mock.method(db, 'transaction', async (cb: any) => {
      txCount++;
      const fakeTx = {
        orm: {
          public: {
            Interview: {
              where: () => ({ update: async () => ({}) }),
            },
            EvaluationReport: {
              where: () => ({
                first: async () => {
                  if (txCount > 1) {
                    return {
                      id: 'rep-1',
                      interviewId,
                      status: 'COMPLETED',
                      overallScore: 100,
                      performanceLevel: 'Expert',
                      summary: 'Coding assessment completed.',
                      questionsEvaluated: 1,
                      reportPayload: savedReportPayload,
                      errorMessage: null,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    };
                  }
                  return null;
                },
                update: async (data: any) => {
                  savedReportPayload = data.reportPayload;
                },
              }),
              create: async (data: any) => ({ ...data, id: 'rep-1', updatedAt: new Date() }),
            },
            Evaluation: {
              where: () => ({ first: async () => null }),
              create: async () => ({}),
            },
          },
        },
      };
      return await cb(fakeTx);
    });

    const reportRes = await evaluationService.generateEvaluationReport(interviewId);

    assert.strictEqual(geminiInvoked, false, 'Gemini batch evaluator should never be called for coding-only interview');
    assert.strictEqual(reportRes.overallScore, 100);
    assert.strictEqual(reportRes.reportPayload?.questions[0].questionType, 'CODING');
    assert.strictEqual(reportRes.reportPayload?.questions[0].submissionStatus, 'Accepted');
    assert.strictEqual(reportRes.reportPayload?.questions[0].testsPassed, 5);
    assert.strictEqual(reportRes.reportPayload?.questions[0].totalTests, 5);
  });

  describe('Function-Based DSA Problems & Execution Harness Suite', () => {
    const TARGET_SLUGS = [
      'two-sum-ii-input-array-is-sorted',
      'valid-palindrome',
      'reverse-linked-list',
      'linked-list-cycle',
      'coin-change'
    ];

    it('all 5 target problems have complete, valid catalog definitions with 3 genuine examples', () => {
      for (const slug of TARGET_SLUGS) {
        const problem = CODING_PROBLEMS_CATALOG[slug];
        assert.ok(problem, `Problem '${slug}' must exist in catalog`);
        assert.strictEqual(problem.slug, slug);
        assert.ok(problem.title && problem.title.length > 0);
        assert.ok(['EASY', 'MEDIUM', 'HARD'].includes(problem.difficulty));
        assert.ok(problem.category && problem.category.length > 0);
        assert.ok(problem.description && problem.description.length > 20);
        assert.ok(problem.constraints && problem.constraints.length >= 2);
        assert.strictEqual(problem.examples.length, 3, `Problem '${slug}' must have exactly 3 public examples`);

        for (let i = 0; i < problem.examples.length; i++) {
          const ex = problem.examples[i];
          assert.ok(ex.input != null, `Example ${i + 1} of '${slug}' must have input`);
          assert.ok(ex.output != null, `Example ${i + 1} of '${slug}' must have output`);
        }
      }
    });

    it('starterCode provides language-appropriate function templates (class Solution) for C++, Python, and Java', () => {
      for (const slug of TARGET_SLUGS) {
        const problem = CODING_PROBLEMS_CATALOG[slug];
        assert.ok(problem.starterCode.cpp, `C++ starter code required for '${slug}'`);
        assert.ok(problem.starterCode.python, `Python starter code required for '${slug}'`);
        assert.ok(problem.starterCode.java, `Java starter code required for '${slug}'`);

        // Check C++ function style
        assert.ok(problem.starterCode.cpp.includes('class Solution'), `C++ starter for '${slug}' should define class Solution`);
        assert.ok(!problem.starterCode.cpp.includes('int main('), `C++ starter for '${slug}' should NOT force candidate to write int main()`);

        // Check Python function style
        assert.ok(problem.starterCode.python.includes('class Solution:'), `Python starter for '${slug}' should define class Solution:`);
        assert.ok(!problem.starterCode.python.includes("if __name__ == '__main__':"), `Python starter for '${slug}' should NOT force candidate to write main guard`);

        // Check Java function style
        assert.ok(problem.starterCode.java.includes('class Solution'), `Java starter for '${slug}' should define class Solution`);
        assert.ok(!problem.starterCode.java.includes('public static void main('), `Java starter for '${slug}' should NOT force candidate to write public static void main()`);
      }

      // Check specific expected signatures
      const cycleProblem = CODING_PROBLEMS_CATALOG['linked-list-cycle'];
      assert.ok(cycleProblem.starterCode.cpp.includes('bool hasCycle(ListNode *head)'));
      assert.ok(cycleProblem.starterCode.python.includes('def hasCycle(self, head: Optional[ListNode]) -> bool:'));
      assert.ok(cycleProblem.starterCode.java.includes('public boolean hasCycle(ListNode head)'));

      const twoSumProblem = CODING_PROBLEMS_CATALOG['two-sum-ii-input-array-is-sorted'];
      assert.ok(twoSumProblem.starterCode.cpp.includes('vector<int> twoSum('));
      assert.ok(twoSumProblem.starterCode.python.includes('def twoSum(self, numbers: list[int], target: int) -> list[int]:'));
      assert.ok(twoSumProblem.starterCode.java.includes('public int[] twoSum('));

      const palindromeProblem = CODING_PROBLEMS_CATALOG['valid-palindrome'];
      assert.ok(palindromeProblem.starterCode.cpp.includes('bool isPalindrome('));
      assert.ok(palindromeProblem.starterCode.python.includes('def isPalindrome('));
      assert.ok(palindromeProblem.starterCode.java.includes('boolean isPalindrome('));

      const reverseProblem = CODING_PROBLEMS_CATALOG['reverse-linked-list'];
      assert.ok(reverseProblem.starterCode.cpp.includes('ListNode* reverseList('));
      assert.ok(reverseProblem.starterCode.python.includes('def reverseList('));
      assert.ok(reverseProblem.starterCode.java.includes('ListNode reverseList('));

      const coinProblem = CODING_PROBLEMS_CATALOG['coin-change'];
      assert.ok(coinProblem.starterCode.cpp.includes('int coinChange('));
      assert.ok(coinProblem.starterCode.python.includes('def coinChange('));
      assert.ok(coinProblem.starterCode.java.includes('int coinChange('));
    });

    it('buildExecutionHarness wraps function solutions into isolated executable programs with correct stdin parsing and serialization', () => {
      const languages: ('cpp' | 'python' | 'java')[] = ['cpp', 'python', 'java'];

      for (const slug of TARGET_SLUGS) {
        for (const lang of languages) {
          const candidateCode = CODING_PROBLEMS_CATALOG[slug].starterCode[lang];
          const wrapped = buildExecutionHarness(slug, lang, candidateCode);

          assert.ok(wrapped.length > candidateCode.length, `Harness should wrap code for ${slug} (${lang})`);

          if (lang === 'cpp') {
            assert.ok(wrapped.includes('int main('), `C++ harness for ${slug} must define main()`);
            assert.ok(wrapped.includes('Solution solver') || wrapped.includes('Solution'), `C++ harness for ${slug} must instantiate Solution`);
          } else if (lang === 'python') {
            assert.ok(wrapped.includes("if __name__ == '__main__':"), `Python harness for ${slug} must include entry guard`);
            assert.ok(wrapped.includes('solver = Solution()') || wrapped.includes('Solution()'), `Python harness for ${slug} must instantiate Solution`);
          } else if (lang === 'java') {
            assert.ok(wrapped.includes('public class Main'), `Java harness for ${slug} must define public class Main`);
            assert.ok(wrapped.includes('Solution solver = new Solution()') || wrapped.includes('Solution()'), `Java harness for ${slug} must instantiate Solution`);
            assert.ok(!wrapped.includes('public class Solution'), `Java harness must sanitize public class Solution to class Solution`);
          }
        }
      }
    });

    it('buildExecutionHarness preserves custom programs with existing main functions', () => {
      const customCpp = `#include <iostream>\nint main() { std::cout << "custom"; return 0; }`;
      assert.strictEqual(buildExecutionHarness('valid-palindrome', 'cpp', customCpp), customCpp);

      const customPy = `if __name__ == '__main__':\n    print("custom")`;
      assert.strictEqual(buildExecutionHarness('valid-palindrome', 'python', customPy), customPy);

      const customJava = `public class Main { public static void main(String[] args) { System.out.println("custom"); } }`;
      assert.strictEqual(buildExecutionHarness('valid-palindrome', 'java', customJava), customJava);
    });

    it('correctly maps natural-language interview questions to the 5 catalog problems', () => {
      const mappingChecks = [
        { text: 'Describe an algorithm to detect a cycle in a singly linked list.', expectedSlug: 'linked-list-cycle' },
        { text: 'Detect a cycle in a linked list (Difficulty: MEDIUM)', expectedSlug: 'linked-list-cycle' },
        { text: 'How do you reverse a singly linked list?', expectedSlug: 'reverse-linked-list' },
        { text: 'Reverse a linked list (Difficulty: EASY)', expectedSlug: 'reverse-linked-list' },
        { text: 'How do you check if a string is a palindrome?', expectedSlug: 'valid-palindrome' },
        { text: 'Explain how to solve the coin change problem using dynamic programming.', expectedSlug: 'coin-change' },
        { text: 'Two Sum II — Input Array Is Sorted: Given a 1-indexed array of integers numbers...', expectedSlug: 'two-sum-ii-input-array-is-sorted' }
      ];

      for (const { text, expectedSlug } of mappingChecks) {
        const found = findCodingProblemForQuestion(text);
        assert.ok(found, `Expected problem mapping for '${text}'`);
        assert.strictEqual(found.slug, expectedSlug, `Problem text '${text}' should resolve to slug '${expectedSlug}'`);
      }
    });

    it('getCodingProblem resolves problem metadata from questionText when codingProblemSlug was null in database', async () => {
      mock.method(db.orm.public.Question, 'where', () => ({
        first: async () => ({
          id: 'q-cycle-legacy',
          interviewId: 'int-123',
          type: 'CODING',
          codingProblemSlug: null,
          questionText: 'Describe an algorithm to detect a cycle in a singly linked list.'
        })
      }));

      const runner = new Judge0Service({ baseUrl: 'http://localhost:2358' });
      const hiddenLoader = new HiddenTestLoader();
      const codingSvc = new CodingService(runner, hiddenLoader);

      const res = await codingSvc.getCodingProblem('int-123', 'q-cycle-legacy');
      assert.strictEqual(res.supported, true);
      assert.strictEqual(res.problem?.slug, 'linked-list-cycle');
      assert.strictEqual(res.problem?.title, 'Linked List Cycle');
      assert.strictEqual(res.problem?.examples.length, 3);
      assert.ok(res.problem?.starterCode.cpp.includes('hasCycle'));
    });

    it('runCode wraps function solution with execution harness and executes in Judge0 sandbox without persisting submission', async () => {
      mock.method(db.orm.public.Question, 'where', () => ({
        first: async () => ({
          id: 'q-pal-1',
          interviewId: 'int-123',
          type: 'CODING',
          codingProblemSlug: 'valid-palindrome',
          questionText: 'How do you check if a string is a palindrome?'
        })
      }));

      let executedCode = '';
      const mockRunner = {
        executeBatch: async (opts: any) => {
          executedCode = opts.sourceCode;
          return {
            overallStatus: 'Accepted',
            testsPassed: 3,
            totalTests: 3,
            results: opts.testCases.map((tc: any, i: number) => ({
              status: 'Accepted',
              passed: true,
              actualOutput: tc.expectedOutput + '\n',
              executionTimeMs: 15,
              memoryKb: 4096
            })),
            compileOutput: null
          };
        }
      } as any;

      const mockHidden = {
        hasHiddenTests: async () => true,
        getHiddenTestCases: async () => []
      } as any;

      let submissionCreated = false;
      mock.method(db.orm.public.CodeSubmission, 'create', async () => {
        submissionCreated = true;
        return {} as any;
      });

      const codingSvc = new CodingService(mockRunner, mockHidden);
      const res = await codingSvc.runCode({
        interviewId: 'int-123',
        questionId: 'q-pal-1',
        language: 'python',
        sourceCode: `class Solution:\n    def isPalindrome(self, s: str) -> bool:\n        c = [ch.lower() for ch in s if ch.isalnum()]\n        return c == c[::-1]`
      });

      assert.strictEqual(res.overallStatus, 'Accepted');
      assert.strictEqual(res.testsPassed, 3);
      assert.strictEqual(res.totalTests, 3);
      assert.strictEqual(res.results.length, 3);
      assert.strictEqual(submissionCreated, false, 'Run Code must never persist CodeSubmission');
      assert.ok(executedCode.includes("if __name__ == '__main__':"), 'Executed code should contain harness entry point');
      assert.ok(executedCode.includes('solver = Solution()'), 'Executed code should instantiate candidate Solution');
    });

    it('submitSolution executes harness, persists original code, sanitizes hidden test outputs, and triggers interview completion', async () => {
      const interviewId = 'int-completion-test';
      const questionId = 'q-cycle-submit';

      mock.method(db.orm.public.Question, 'where', () => ({
        first: async () => ({
          id: questionId,
          interviewId,
          type: 'CODING',
          codingProblemSlug: 'linked-list-cycle',
          questionText: 'Describe an algorithm to detect a cycle in a singly linked list.'
        })
      }));

      const mockRunner = {
        executeBatch: async (opts: any) => {
          return {
            overallStatus: 'Accepted',
            testsPassed: opts.testCases.length,
            totalTests: opts.testCases.length,
            results: opts.testCases.map(() => ({
              status: 'Accepted',
              passed: true,
              actualOutput: 'true\n',
              executionTimeMs: 20,
              memoryKb: 5120
            })),
            compileOutput: null
          };
        }
      } as any;

      const mockHidden = {
        hasHiddenTests: async () => true,
        getHiddenTestCases: async () => [
          { problemSlug: 'linked-list-cycle', input: '[1]\n0', expectedOutput: 'true', orderIndex: 1 },
          { problemSlug: 'linked-list-cycle', input: '[1,2]\n-1', expectedOutput: 'false', orderIndex: 2 }
        ]
      } as any;

      let savedSubmission: any = null;
      let interviewCompleted = false;

      mock.method(db, 'transaction', async (cb: any) => {
        const fakeTx = {
          orm: {
            public: {
              CodeSubmission: {
                create: async (data: any) => {
                  savedSubmission = data;
                  return { id: 'sub-new-1', ...data };
                },
                where: () => ({
                  all: async () => [{ questionId }]
                })
              },
              Interview: {
                where: () => ({
                  first: async () => ({ id: interviewId, status: 'IN_PROGRESS', questionCount: 1 }),
                  update: async (data: any) => {
                    if (data.status === 'COMPLETED') interviewCompleted = true;
                  }
                })
              },
              Question: {
                where: () => ({
                  all: async () => [{ id: questionId, type: 'CODING' }]
                })
              },
              Answer: {
                where: () => ({
                  aggregate: async () => ({ count: 0 })
                })
              }
            }
          }
        };
        return await cb(fakeTx);
      });

      const codingSvc = new CodingService(mockRunner, mockHidden);
      const candidateCode = `class Solution {\npublic:\n    bool hasCycle(ListNode *head) { return true; }\n};`;

      const res = await codingSvc.submitSolution({
        interviewId,
        questionId,
        language: 'cpp',
        sourceCode: candidateCode
      });

      assert.strictEqual(res.status, 'Accepted');
      assert.strictEqual(res.testsPassed, 5); // 3 public + 2 hidden
      assert.strictEqual(res.totalTests, 5);

      // Verify public results contain input/expectedOutput
      assert.strictEqual(res.publicResults.length, 3);
      assert.ok(res.publicResults[0].input != null);
      assert.ok(res.publicResults[0].expectedOutput != null);

      // Verify hidden results are completely sanitized (no input, no expectedOutput)
      assert.strictEqual(res.hiddenResults.length, 2);
      for (const hRes of res.hiddenResults) {
        assert.strictEqual((hRes as any).input, undefined, 'Hidden test input must never be returned in submit response');
        assert.strictEqual((hRes as any).expectedOutput, undefined, 'Hidden test expected output must never be returned in submit response');
        assert.strictEqual((hRes as any).actualOutput, undefined, 'Hidden test actual output must never be returned in submit response');
        assert.ok(hRes.passed === true);
        assert.ok(hRes.label.startsWith('Hidden Test'));
      }

      // Verify persisted submission stores original code, NOT harness
      assert.strictEqual(savedSubmission.sourceCode, candidateCode, 'Persisted submission must store clean candidate code, not harness');
      assert.strictEqual(interviewCompleted, true, 'Interview should transition to COMPLETED');
    });

    it('submitSolution rejects with BAD_REQUEST when private hidden tests are unconfigured and does not fabricate results', async () => {
      mock.method(db.orm.public.Question, 'where', () => ({
        first: async () => ({
          id: 'q-no-hidden',
          interviewId: 'int-123',
          type: 'CODING',
          codingProblemSlug: 'linked-list-cycle',
          questionText: 'Describe an algorithm to detect a cycle in a singly linked list.'
        })
      }));

      const mockRunner = {} as any;
      const mockHidden = {
        hasHiddenTests: async () => false,
        getHiddenTestCases: async () => []
      } as any;

      const codingSvc = new CodingService(mockRunner, mockHidden);

      await assert.rejects(
        async () => {
          await codingSvc.submitSolution({
            interviewId: 'int-123',
            questionId: 'q-no-hidden',
            language: 'python',
            sourceCode: 'class Solution: pass'
          });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'BAD_REQUEST');
          assert.ok(err.message.includes('Private hidden test cases are not configured'));
          return true;
        }
      );
    });

    it('unmapped coding question without valid slug returns supported: false and rejects execution', async () => {
      mock.method(db.orm.public.Question, 'where', () => ({
        first: async () => ({
          id: 'q-unmapped-custom',
          interviewId: 'int-123',
          type: 'CODING',
          codingProblemSlug: null,
          questionText: 'Write a completely custom uncataloged problem statement'
        })
      }));

      const codingSvc = new CodingService({} as any, {} as any);

      const probRes = await codingSvc.getCodingProblem('int-123', 'q-unmapped-custom');
      assert.strictEqual(probRes.supported, false);
      assert.ok(probRes.error?.includes('not configured'));

      await assert.rejects(
        async () => {
          await codingSvc.runCode({
            interviewId: 'int-123',
            questionId: 'q-unmapped-custom',
            language: 'cpp',
            sourceCode: 'class Solution {};'
          });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'NOT_FOUND');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await codingSvc.submitSolution({
            interviewId: 'int-123',
            questionId: 'q-unmapped-custom',
            language: 'cpp',
            sourceCode: 'class Solution {};'
          });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'NOT_FOUND');
          return true;
        }
      );
    });
  });
});
