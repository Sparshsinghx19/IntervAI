import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { evaluationService } from './evaluation.service.js';
import { aiEvaluatorService } from './ai-evaluator.service.js';
import { db } from '../../prisma/db.js';
import { interviewLifecycle } from '../interviews/interview-lifecycle.service.js';

/** These suites use hand-built ORM mocks; the interview clock is covered in interview-lifecycle.test.ts. */
const stubInterviewLifecycle = () => {
  mock.method(interviewLifecycle, 'expireIfDue', async () => false);
  mock.method(interviewLifecycle, 'assertOpen', async () => undefined);
  mock.method(interviewLifecycle, 'lockOpenForSubmission', async () => undefined);
  mock.method(interviewLifecycle, 'expireOverdueForOwner', async () => undefined);
};

describe('Evaluation Service - Integration & State Transitions', () => {
  beforeEach(() => {
    mock.restoreAll();
    stubInterviewLifecycle();
  });

  const mockInterview = {
    id: '11111111-1111-1111-1111-111111111111',
    type: 'TECHNICAL',
    difficulty: 'MEDIUM',
    focusArea: 'OS',
    questionCount: 5,
  };

  const mockQuestion = {
    id: '22222222-2222-2222-2222-222222222222',
    interviewId: '11111111-1111-1111-1111-111111111111',
    questionText: 'What is thrashing in OS?',
    orderIndex: 1,
  };

  const mockAnswer = {
    id: '33333333-3333-3333-3333-333333333333',
    questionId: '22222222-2222-2222-2222-222222222222',
    answerText: 'Thrashing occurs when the system spends more time paging than executing.',
    submittedAt: new Date(),
  };

  it('rejects if interview is not found', async () => {
    mock.method(db.orm.public.Interview, 'first', async () => null);

    await assert.rejects(
      evaluationService.evaluateAnswer(mockInterview.id, mockQuestion.id),
      (err: any) => err.code === 'NOT_FOUND' && err.message === 'Interview not found'
    );
  });

  it('rejects if question does not belong to interview or is missing', async () => {
    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => ({ ...mockQuestion, interviewId: 'other-interview-id' }),
    }));

    await assert.rejects(
      evaluationService.evaluateAnswer(mockInterview.id, mockQuestion.id),
      (err: any) =>
        err.code === 'NOT_FOUND' &&
        err.message === 'Question not found or does not belong to this interview'
    );
  });

  it('rejects if answer has not been saved yet', async () => {
    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => mockQuestion,
    }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      first: async () => null,
    }));

    await assert.rejects(
      evaluationService.evaluateAnswer(mockInterview.id, mockQuestion.id),
      (err: any) =>
        err.code === 'NOT_FOUND' && err.message === 'No answer found for this question'
    );
  });

  it('returns cached evaluation without calling AI evaluator if already COMPLETED', async () => {
    const existingCompleted = {
      id: '44444444-4444-4444-4444-444444444444',
      answerId: mockAnswer.id,
      status: 'COMPLETED',
      correctnessScore: 90,
      completenessScore: 85,
      reasoningScore: 80,
      clarityScore: 95,
      overallScore: 88,
      summary: 'Excellent explanation of thrashing.',
      strengths: ['Clear definition', 'High technical clarity'],
      improvements: ['Mention working set model'],
      sampleAnswer: 'Detailed reference...',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => mockQuestion,
    }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      first: async () => mockAnswer,
    }));
    mock.method(db, 'transaction', async (callback: any) => {
      const mockTx = {
        orm: {
          public: {
            Evaluation: {
              where: () => ({
                first: async () => existingCompleted,
              }),
            },
          },
        },
      };
      return callback(mockTx);
    });

    const aiMock = mock.method(aiEvaluatorService, 'evaluate', async () => {
      throw new Error('Should never call AI evaluator for COMPLETED evaluation');
    });

    const result = await evaluationService.evaluateAnswer(mockInterview.id, mockQuestion.id);

    assert.strictEqual(aiMock.mock.callCount(), 0);
    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.overallScore, 88);
    assert.strictEqual(result.summary, existingCompleted.summary);
  });

  it('prevents duplicate concurrent evaluation requests when already PENDING', async () => {
    const freshPending = {
      id: '44444444-4444-4444-4444-444444444444',
      answerId: mockAnswer.id,
      status: 'PENDING',
      updatedAt: new Date(), // Just created 100ms ago
    };

    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => mockQuestion,
    }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      first: async () => mockAnswer,
    }));
    mock.method(db, 'transaction', async (callback: any) => {
      const mockTx = {
        orm: {
          public: {
            Evaluation: {
              where: () => ({
                first: async () => freshPending,
              }),
            },
          },
        },
      };
      return callback(mockTx);
    });

    await assert.rejects(
      evaluationService.evaluateAnswer(mockInterview.id, mockQuestion.id),
      (err: any) =>
        err.code === 'CONFLICT' &&
        err.message === 'Evaluation is currently in progress for this answer'
    );
  });

  it('evaluates successfully and persists COMPLETED record', async () => {
    let persistedRecord: any = null;

    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => mockQuestion,
    }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      first: async () => mockAnswer,
    }));

    mock.method(db, 'transaction', async (callback: any) => {
      const mockTx = {
        orm: {
          public: {
            Evaluation: {
              where: () => ({
                first: async () => persistedRecord,
                update: async (updates: any) => {
                  persistedRecord = { ...persistedRecord, ...updates, updatedAt: new Date() };
                },
              }),
              create: async (data: any) => {
                persistedRecord = {
                  id: 'eval-uuid-123',
                  ...data,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
                return persistedRecord;
              },
            },
          },
        },
      };
      return callback(mockTx);
    });

    mock.method(db.orm.public.Evaluation, 'where', () => ({
      first: async () => persistedRecord,
    }));

    const mockEvalResult = {
      correctnessScore: 85,
      completenessScore: 80,
      reasoningScore: 80,
      clarityScore: 90,
      overallScore: 83,
      summary: 'Well reasoned answer on thrashing.',
      strengths: ['Clear definition of memory overload'],
      improvements: ['Explain page replacement algorithms'],
      sampleAnswer: 'Thrashing occurs when...',
    };

    const aiMock = mock.method(aiEvaluatorService, 'evaluate', async () => mockEvalResult);

    const result = await evaluationService.evaluateAnswer(mockInterview.id, mockQuestion.id);

    assert.strictEqual(aiMock.mock.callCount(), 1);
    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.overallScore, 83);
    assert.strictEqual(persistedRecord.status, 'COMPLETED');
  });

  it('marks evaluation as FAILED on provider error and preserves candidate answer', async () => {
    let evaluationState: any = null;

    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => mockQuestion,
    }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      first: async () => mockAnswer,
    }));

    mock.method(db, 'transaction', async (callback: any) => {
      const mockTx = {
        orm: {
          public: {
            Evaluation: {
              where: () => ({
                first: async () => evaluationState,
                update: async (updates: any) => {
                  evaluationState = { ...evaluationState, ...updates };
                },
              }),
              create: async (data: any) => {
                evaluationState = { id: 'eval-failed-123', ...data };
                return evaluationState;
              },
            },
          },
        },
      };
      return callback(mockTx);
    });

    mock.method(aiEvaluatorService, 'evaluate', async () => {
      throw new Error('Gemini model connection timed out');
    });

    await assert.rejects(
      evaluationService.evaluateAnswer(mockInterview.id, mockQuestion.id),
      (err: any) =>
        err.code === 'PROVIDER_ERROR' &&
        /AI evaluation service temporarily unavailable/.test(err.message)
    );

    // Verify evaluation record was marked FAILED (ready for retry)
    assert.strictEqual(evaluationState.status, 'FAILED');
    // Verify candidate answer was never altered
    assert.strictEqual(mockAnswer.answerText, 'Thrashing occurs when the system spends more time paging than executing.');
  });

  it('allows retry when previous evaluation was FAILED', async () => {
    let evaluationState: any = {
      id: 'eval-retry-123',
      answerId: mockAnswer.id,
      status: 'FAILED',
      updatedAt: new Date(Date.now() - 10000),
    };

    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      first: async () => mockQuestion,
    }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      first: async () => mockAnswer,
    }));

    mock.method(db, 'transaction', async (callback: any) => {
      const mockTx = {
        orm: {
          public: {
            Evaluation: {
              where: () => ({
                first: async () => evaluationState,
                update: async (updates: any) => {
                  evaluationState = { ...evaluationState, ...updates };
                },
              }),
            },
          },
        },
      };
      return callback(mockTx);
    });

    mock.method(db.orm.public.Evaluation, 'where', () => ({
      first: async () => evaluationState,
    }));

    const mockEvalResult = {
      correctnessScore: 90,
      completenessScore: 90,
      reasoningScore: 85,
      clarityScore: 90,
      overallScore: 89,
      summary: 'Successful retry evaluation.',
      strengths: ['Great technical details'],
      improvements: ['None'],
      sampleAnswer: 'Reference outline...',
    };

    mock.method(aiEvaluatorService, 'evaluate', async () => mockEvalResult);

    const result = await evaluationService.evaluateAnswer(mockInterview.id, mockQuestion.id);

    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.overallScore, 89);
    assert.strictEqual(evaluationState.status, 'COMPLETED');
  });
});
