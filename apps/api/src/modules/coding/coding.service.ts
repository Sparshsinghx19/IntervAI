import { db } from '../../prisma/db.js';
import { CODING_PROBLEMS_CATALOG, codeExecutionEnabled, effectiveQuestionType, findCodingProblemForQuestion } from './coding-problems.catalog.js';
import { judge0Service, Judge0Service, RunnerUnavailableError } from './judge0.service.js';
import { hiddenTestLoader, HiddenTestLoader } from './hidden-test-loader.js';
import { buildExecutionHarness } from './coding-harness.js';
import { interviewLifecycle } from '../interviews/interview-lifecycle.service.js';
import {
  PublicCodingProblem,
  RunCodeResponse,
  SubmitCodeResponse,
  SupportedLanguage,
  TestCaseResult,
  HiddenTestCaseResult,
} from './coding.types.js';

export class CodingService {
  constructor(
    private runner: Judge0Service = judge0Service,
    private hiddenLoader: HiddenTestLoader = hiddenTestLoader
  ) {}

  /**
   * Retrieves public coding problem metadata for an interview question.
   * Ensures the question belongs to the interview and is typed as CODING.
   * NEVER returns hidden test inputs/outputs.
   */
  public async getCodingProblem(interviewId: string, questionId: string): Promise<{
    supported: boolean;
    problem?: PublicCodingProblem;
    error?: string;
  }> {
    const question = await db.orm.public.Question.where({ id: questionId }).first();
    if (!question || question.interviewId !== interviewId) {
      const err = new Error('Question not found or does not belong to this interview');
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (question.type !== 'CODING') {
      const err = new Error('Requested question is not a coding question');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }

    let slug = question.codingProblemSlug;
    if (!slug) {
      const resolved = findCodingProblemForQuestion(question.questionText);
      if (resolved) {
        slug = resolved.slug;
      }
    }

    if (!slug) {
      return {
        supported: false,
        error: 'Coding problem is not configured for this question.',
      };
    }

    const problemMetadata = CODING_PROBLEMS_CATALOG[slug];
    if (!problemMetadata) {
      return {
        supported: false,
        error: `Coding problem '${slug}' is not currently available in the problem catalog.`,
      };
    }

    const hasHiddenTests = await this.hiddenLoader.hasHiddenTests(slug);

    return {
      supported: true,
      problem: {
        slug: problemMetadata.slug,
        title: problemMetadata.title,
        difficulty: problemMetadata.difficulty,
        category: problemMetadata.category,
        description: problemMetadata.description,
        constraints: problemMetadata.constraints,
        examples: problemMetadata.examples,
        starterCode: problemMetadata.starterCode,
        hasHiddenTests,
      },
    };
  }

  /**
   * Runs candidate code against public sample cases only.
   * Does NOT persist a CodeSubmission or mark question as completed.
   */
  public async runCode(options: {
    interviewId: string;
    questionId: string;
    language: SupportedLanguage;
    sourceCode: string;
  }): Promise<RunCodeResponse> {
    if (!codeExecutionEnabled()) {
      // Never reach a runner when public execution is switched off.
      throw new RunnerUnavailableError('Code execution is not available in this beta. Answer coding questions in text.');
    }
    if (!['cpp', 'python', 'java'].includes(options.language)) {
      const err = new Error(`Unsupported execution language '${options.language}'. Supported: C++, Python, Java.`);
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }

    if (!options.sourceCode || options.sourceCode.trim() === '') {
      const err = new Error('Source code cannot be empty.');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }

    if (options.sourceCode.length > Judge0Service.MAX_SOURCE_LENGTH) {
      const err = new Error('Source code exceeds 64KB maximum limit.');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }

    const question = await db.orm.public.Question.where({ id: options.questionId }).first();
    if (!question || question.interviewId !== options.interviewId) {
      const err = new Error('Question not found or does not belong to this interview');
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (question.type !== 'CODING') {
      const err = new Error('Cannot run code for non-coding question');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }

    let slug = question.codingProblemSlug;
    if (!slug) {
      const resolved = findCodingProblemForQuestion(question.questionText);
      if (resolved) {
        slug = resolved.slug;
      }
    }

    if (!slug || !CODING_PROBLEMS_CATALOG[slug]) {
      const err = new Error('Coding problem metadata not found for this question');
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const catalogProblem = CODING_PROBLEMS_CATALOG[slug];
    const testCases = catalogProblem.examples.map(ex => ({
      input: ex.input,
      expectedOutput: ex.output,
    }));

    // Wrap candidate code in language-specific execution harness
    const wrappedCode = buildExecutionHarness(slug, options.language, options.sourceCode);

    // Run batch outside of any DB transaction
    const execution = await this.runner.executeBatch({
      language: options.language,
      sourceCode: wrappedCode,
      testCases,
    });

    const results: TestCaseResult[] = execution.results.map((r, idx) => ({
      label: `Example ${idx + 1}`,
      passed: r.passed,
      status: r.status,
      input: testCases[idx].input,
      expectedOutput: testCases[idx].expectedOutput,
      actualOutput: r.actualOutput,
      executionTimeMs: r.executionTimeMs,
      memoryKb: r.memoryKb,
      errorMessage: r.errorMessage,
    }));

    return {
      overallStatus: execution.overallStatus,
      testsPassed: execution.testsPassed,
      totalTests: execution.totalTests,
      results,
      compileOutput: execution.compileOutput,
    };
  }

  /**
   * Submits solution: runs public examples + private hidden tests.
   * Persists CodeSubmission record and evaluates interview completion.
   * Returns full public details and sanitized hidden test cards (no hidden inputs/outputs).
   */
  public async submitSolution(options: {
    interviewId: string;
    questionId: string;
    language: SupportedLanguage;
    sourceCode: string;
  }): Promise<SubmitCodeResponse> {
    if (!codeExecutionEnabled()) {
      // Never reach a runner when public execution is switched off.
      throw new RunnerUnavailableError('Code execution is not available in this beta. Answer coding questions in text.');
    }
    if (!['cpp', 'python', 'java'].includes(options.language)) {
      const err = new Error(`Unsupported execution language '${options.language}'. Supported: C++, Python, Java.`);
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }

    if (!options.sourceCode || options.sourceCode.trim() === '') {
      const err = new Error('Source code cannot be empty.');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }

    if (options.sourceCode.length > Judge0Service.MAX_SOURCE_LENGTH) {
      const err = new Error('Source code exceeds 64KB maximum limit.');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }

    const question = await db.orm.public.Question.where({ id: options.questionId }).first();
    if (!question || question.interviewId !== options.interviewId) {
      const err = new Error('Question not found or does not belong to this interview');
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (question.type !== 'CODING') {
      const err = new Error('Cannot submit code for non-coding question');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }

    let slug = question.codingProblemSlug;
    if (!slug) {
      const resolved = findCodingProblemForQuestion(question.questionText);
      if (resolved) {
        slug = resolved.slug;
      }
    }

    if (!slug || !CODING_PROBLEMS_CATALOG[slug]) {
      const err = new Error('Coding problem metadata not found for this question');
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const catalogProblem = CODING_PROBLEMS_CATALOG[slug];

    // Refuse early (before running code) if the interview is closed or past its deadline.
    await interviewLifecycle.assertOpen(options.interviewId);

    const hiddenCases = await this.hiddenLoader.getHiddenTestCases(slug);

    if (hiddenCases.length === 0) {
      const err = new Error('Submission cannot be processed: Private hidden test cases are not configured for this problem in this environment.');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }

    // Combine public examples and private hidden cases
    const publicCount = catalogProblem.examples.length;
    const allTestCases: Array<{ input: string; expectedOutput: string; isHidden: boolean }> = [
      ...catalogProblem.examples.map(ex => ({ input: ex.input, expectedOutput: ex.output, isHidden: false })),
      ...hiddenCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput, isHidden: true })),
    ];

    // Wrap candidate code in language-specific execution harness
    const wrappedCode = buildExecutionHarness(slug, options.language, options.sourceCode);

    // Execute outside database transaction
    const execution = await this.runner.executeBatch({
      language: options.language,
      sourceCode: wrappedCode,
      testCases: allTestCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
    });

    const publicResults: TestCaseResult[] = [];
    const hiddenResults: HiddenTestCaseResult[] = [];
    let maxTimeMs = 0;
    let maxMemoryKb = 0;

    for (let i = 0; i < execution.results.length; i++) {
      const r = execution.results[i];
      if (r.executionTimeMs && r.executionTimeMs > maxTimeMs) maxTimeMs = r.executionTimeMs;
      if (r.memoryKb && r.memoryKb > maxMemoryKb) maxMemoryKb = r.memoryKb;

      if (i < publicCount) {
        publicResults.push({
          label: `Example ${i + 1}`,
          passed: r.passed,
          status: r.status,
          input: allTestCases[i].input,
          expectedOutput: allTestCases[i].expectedOutput,
          actualOutput: r.actualOutput,
          executionTimeMs: r.executionTimeMs,
          memoryKb: r.memoryKb,
          errorMessage: r.errorMessage,
        });
      } else {
        const hiddenIdx = i - publicCount + 1;
        hiddenResults.push({
          label: `Hidden Test ${hiddenIdx}`,
          passed: r.passed,
          status: r.status,
          executionTimeMs: r.executionTimeMs,
          memoryKb: r.memoryKb,
        });
      }
    }

    // Short DB transaction to persist submission and check interview completion
    const submission = await db.transaction(async (tx) => {
      // The deadline is re-checked under a row lock: a run that finishes after the
      // time limit is not recorded.
      await interviewLifecycle.lockOpenForSubmission(tx, options.interviewId);
      const created = await tx.orm.public.CodeSubmission.create({
        interviewId: options.interviewId,
        questionId: options.questionId,
        language: options.language,
        sourceCode: options.sourceCode,
        status: execution.overallStatus,
        testsPassed: execution.testsPassed,
        totalTests: execution.totalTests,
        executionTimeMs: maxTimeMs || null,
        memoryKb: maxMemoryKb || null,
      });

      // Check interview completion
      const interview = await tx.orm.public.Interview.where({ id: options.interviewId }).first();
      if (interview && interview.status !== 'COMPLETED') {
        const questions = await tx.orm.public.Question.where({ interviewId: options.interviewId }).all();
        const theoryQuestions = questions.filter((q: any) => effectiveQuestionType(q) !== 'CODING');
        const codingQuestions = questions.filter((q: any) => effectiveQuestionType(q) === 'CODING');

        let theoryAnswered = 0;
        if (theoryQuestions.length > 0) {
          const theoryIds = theoryQuestions.map((q: any) => q.id);
          const ansRes = await tx.orm.public.Answer
            .where((a: any) => a.questionId.in(theoryIds))
            .aggregate((agg: any) => ({ count: agg.count() }));
          theoryAnswered = Number((ansRes as any).count) || 0;
        }

        let codingAnswered = 0;
        if (codingQuestions.length > 0) {
          const codingIds = codingQuestions.map((q: any) => q.id);
          const subs = await tx.orm.public.CodeSubmission
            .where((cs: any) => cs.questionId.in(codingIds))
            .all();
          codingAnswered = new Set(subs.map((s: any) => s.questionId)).size;
        }

        const totalAnswered = theoryAnswered + codingAnswered;
        if (totalAnswered >= interview.questionCount && totalAnswered >= questions.length) {
          await interviewLifecycle.markAllAnswered(tx, options.interviewId);
        }
      }

      return created;
    });

    return {
      submissionId: submission.id,
      status: execution.overallStatus,
      testsPassed: execution.testsPassed,
      totalTests: execution.totalTests,
      executionTimeMs: maxTimeMs || undefined,
      memoryKb: maxMemoryKb || undefined,
      publicResults,
      hiddenResults,
      compileOutput: execution.compileOutput,
      sourceCode: options.sourceCode,
      language: options.language,
    };
  }
}

export const codingService = new CodingService();
