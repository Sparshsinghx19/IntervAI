import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { db } from '../../prisma/db.js';
import {
  classifyNewQuestion,
  CODING_PROBLEMS_CATALOG,
  effectiveQuestionType,
  runnableProblemSlug,
} from '../coding/coding-problems.catalog.js';
import { questionBank } from '../ai/question-bank.js';
import { questionGenerationService } from './question-generation.service.js';
import { questionPlanService } from './question-plan.service.js';
import { countAnsweredQuestions } from './interview-progress.service.js';
import { interviewService } from './interview.service.js';

describe('Coding questions must be runnable', () => {
  it('maps catalog problems by slug or text and rejects unsupported ones', () => {
    assert.strictEqual(runnableProblemSlug({ questionText: 'Anything', codingProblemSlug: 'coin-change' }), 'coin-change');
    assert.strictEqual(runnableProblemSlug({ questionText: 'Reverse a linked list (Difficulty: EASY)' }), 'reverse-linked-list');
    assert.strictEqual(runnableProblemSlug({ questionText: 'Find the middle of a linked list (Difficulty: MEDIUM)' }), null);
    assert.strictEqual(runnableProblemSlug({ questionText: 'Merge two sorted lists', codingProblemSlug: 'not-in-catalog' }), null);
  });

  it('treats a stored CODING question without a runnable problem as a text question', () => {
    assert.strictEqual(effectiveQuestionType({ type: 'CODING', questionText: 'Find the middle of a linked list (Difficulty: MEDIUM)', codingProblemSlug: null }), 'THEORY');
    assert.strictEqual(effectiveQuestionType({ type: 'CODING', questionText: 'Reverse a linked list', codingProblemSlug: 'reverse-linked-list' }), 'CODING');
    assert.strictEqual(effectiveQuestionType({ type: 'SYSTEM_DESIGN', questionText: 'Design a URL shortener' }), 'SYSTEM_DESIGN');
    assert.strictEqual(effectiveQuestionType({ type: null, questionText: 'What is ACID?' }), 'THEORY');
  });

  it('stores CODING only with a runnable slug', () => {
    assert.deepStrictEqual(classifyNewQuestion({ type: 'CODING', questionText: 'Valid Parentheses' }), { type: 'THEORY', codingProblemSlug: null });
    assert.deepStrictEqual(classifyNewQuestion({ type: 'CODING', questionText: 'Detect a cycle in a linked list' }), { type: 'CODING', codingProblemSlug: 'linked-list-cycle' });
    assert.deepStrictEqual(classifyNewQuestion({ type: 'THEORY', questionText: 'x', codingProblemSlug: 'coin-change' }), { type: 'THEORY', codingProblemSlug: null });
  });

  it('fallback DSA questions are all runnable catalog problems', () => {
    const questions = questionGenerationService.generateQuestions('DSA', 'MEDIUM', 7, 'iv');
    assert.strictEqual(questions.length, 7);
    for (const q of questions) {
      assert.strictEqual(q.type, 'CODING', q.questionText);
      assert.ok(q.codingProblemSlug && CODING_PROBLEMS_CATALOG[q.codingProblemSlug], q.questionText);
    }
    assert.ok(!questions.some((q) => /middle of a linked list/i.test(q.questionText)));
    // Non-coding topics are unchanged.
    assert.ok(questionGenerationService.generateQuestions('OS', 'EASY', 3, 'iv').every((q) => q.type === 'THEORY' && q.codingProblemSlug === null));
    assert.ok(questionGenerationService.generateQuestions('System Design', 'EASY', 2, 'iv').every((q) => q.type === 'SYSTEM_DESIGN'));
  });

  it('every CODING entry in the question bank is backed by a runnable problem', () => {
    for (const q of questionBank.filter((x) => x.type === 'CODING')) {
      assert.ok(runnableProblemSlug(q), `bank question ${q.id} has no runnable problem`);
    }
  });

  it('planned coding questions come only from runnable catalog problems', async () => {
    // The model is asked for subject questions; it tries to sneak in a CODING item.
    const generate = (async () => ({
      text: JSON.stringify({ questions: [
        { type: 'CODING', category: 'TECHNICAL', questionText: 'Implement an LRU cache with O(1) get and put operations.' },
        { type: 'THEORY', category: 'SCENARIO', questionText: 'Your service sorts a stream that no longer fits in memory. How do you change the algorithm?' },
      ] }),
    })) as any;
    const plan = await questionPlanService.buildPlan(
      { mode: 'TOPIC', targetRole: 'Software Engineer', focusArea: 'dsa', difficulty: 'HARD', durationMinutes: 45, questionTypes: ['THEORY', 'CODING'], profile: null },
      generate
    );
    assert.ok(plan.questions.some((q) => q.type === 'CODING'), 'a DSA plan includes coding problems');
    for (const q of plan.questions.filter((x) => x.type === 'CODING')) {
      assert.ok(q.codingProblemSlug && CODING_PROBLEMS_CATALOG[q.codingProblemSlug], q.questionText);
    }
    assert.ok(!plan.questions.some((q) => q.type === 'CODING' && /LRU/.test(q.questionText)), 'generated text is never labelled executable');
  });
});

describe('Completion follows the effective type', () => {
  it('counts an unrunnable coding question by its text answer', () => {
    const answered = countAnsweredQuestions([
      { type: 'CODING', questionText: 'Find the middle of a linked list', codingProblemSlug: null, answer: { submittedAt: new Date() }, submissions: [] },
      { type: 'CODING', questionText: 'Reverse a linked list', codingProblemSlug: 'reverse-linked-list', answer: { submittedAt: new Date() }, submissions: [] },
      { type: 'CODING', questionText: 'Coin change', codingProblemSlug: 'coin-change', answer: null, submissions: [{ createdAt: new Date() }] },
    ]);
    // A text answer does not complete a runnable coding question; a code submission does.
    assert.strictEqual(answered, 2);
  });
});

describe('Existing interviews with an unmapped coding question', () => {
  const created: string[] = [];
  after(async () => {
    for (const id of created) {
      const qs = await db.orm.public.Question.where({ interviewId: id }).all();
      for (const q of qs) await db.orm.public.Answer.where({ questionId: q.id }).deleteAll();
      await db.orm.public.Question.where({ interviewId: id }).deleteAll();
      await db.orm.public.Interview.where({ id }).deleteAll();
    }
  });

  it('returns it as a text question with a flag, accepts a text answer and completes the interview', async () => {
    const iv = await db.orm.public.Interview.create({ type: 'TECHNICAL', difficulty: 'MEDIUM', focusArea: 'question-type-test', questionCount: 2 });
    created.push(iv.id);
    const legacy = await db.orm.public.Question.create({
      interviewId: iv.id, questionText: 'Find the middle of a linked list (Difficulty: MEDIUM)', orderIndex: 1, type: 'CODING', codingProblemSlug: null,
    });
    await db.orm.public.Question.create({ interviewId: iv.id, questionText: 'What is ACID?', orderIndex: 2, type: 'THEORY' });

    const questions = await interviewService.getInterviewQuestions(iv.id);
    assert.deepStrictEqual(
      questions.map((q: any) => [q.type, q.codingProblemSlug, q.codingUnavailable]),
      [['THEORY', null, true], ['THEORY', null, false]]
    );

    await interviewService.submitAnswer(iv.id, legacy.id, 'Slow and fast pointers; O(n) time, O(1) space.');
    await interviewService.submitAnswer(iv.id, questions[1].id, 'Atomicity, consistency, isolation, durability.');
    const after = await db.orm.public.Interview.first({ id: iv.id });
    assert.strictEqual(after!.status, 'COMPLETED');
  });
});
