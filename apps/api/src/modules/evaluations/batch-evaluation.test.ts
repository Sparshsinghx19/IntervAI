import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { evaluationService } from './evaluation.service.js';
import {
  aiEvaluatorService,
  calculateOverallScore,
  calculateInterviewOverallScore,
  determinePerformanceLevel,
  validateBatchEvaluationPayload,
} from './ai-evaluator.service.js';
import { gemini } from '../../infrastructure/gemini.js';
import { db } from '../../prisma/db.js';

describe('Batch Evaluation Report - Service & AI Logic', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  const mockInterview = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    type: 'TECHNICAL',
    difficulty: 'HARD',
    focusArea: 'DBMS',
    questionCount: 3,
    status: 'COMPLETED',
  };

  const mockQuestions = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      interviewId: mockInterview.id,
      questionText: 'Explain write-ahead logging (WAL).',
      orderIndex: 1,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      interviewId: mockInterview.id,
      questionText: 'What is 2-Phase Locking (2PL)?',
      orderIndex: 2,
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      interviewId: mockInterview.id,
      questionText: 'Explain B+ Tree vs LSM Tree.',
      orderIndex: 3,
    },
  ];

  const mockAnswers = [
    {
      id: 'ans-1',
      questionId: mockQuestions[0].id,
      answerText: 'WAL ensures durability by writing changes to log before disk.',
      submittedAt: new Date(),
    },
    {
      id: 'ans-2',
      questionId: mockQuestions[1].id,
      answerText: '2PL has a growing phase and shrinking phase to ensure serializability.',
      submittedAt: new Date(),
    },
    {
      id: 'ans-3',
      questionId: mockQuestions[2].id,
      answerText: 'B+ trees optimize for reads with balanced branching; LSM trees optimize for writes.',
      submittedAt: new Date(),
    },
  ];

  it('correctly calculates interview overall score as mathematically rounded average of question scores', () => {
    // Question 1: 90, Question 2: 85, Question 3: 80
    // Average = (90 + 85 + 80) / 3 = 255 / 3 = 85
    const avg1 = calculateInterviewOverallScore([90, 85, 80]);
    assert.strictEqual(avg1, 85);

    // Rounding check: (91 + 92) / 2 = 91.5 => 92
    const avg2 = calculateInterviewOverallScore([91, 92]);
    assert.strictEqual(avg2, 92);

    // Empty check
    assert.strictEqual(calculateInterviewOverallScore([]), 0);
  });

  it('determines performance levels correctly based on composite score', () => {
    assert.strictEqual(determinePerformanceLevel(98), 'Expert');
    assert.strictEqual(determinePerformanceLevel(95), 'Expert');
    assert.strictEqual(determinePerformanceLevel(88), 'Advanced');
    assert.strictEqual(determinePerformanceLevel(75), 'Proficient');
    assert.strictEqual(determinePerformanceLevel(60), 'Developing');
    assert.strictEqual(determinePerformanceLevel(40), 'Needs Foundation');
  });

  it('validates and computes batch evaluation payload with backend score authority', () => {
    const rawModelOutput = {
      summary: 'Strong grasp of core database internals with minor omissions.',
      questions: [
        {
          questionId: mockQuestions[0].id,
          orderIndex: 1,
          correctnessScore: 100,
          completenessScore: 90,
          reasoningScore: 85,
          clarityScore: 90,
          summary: 'Solid grasp of durability guarantees.',
          strengths: ['Identified append-only write advantage.'],
          improvements: ['Mention ARIES recovery algorithm.'],
          sampleAnswer: 'WAL reference answer...',
        },
        {
          questionId: mockQuestions[1].id,
          orderIndex: 2,
          correctnessScore: 90,
          completenessScore: 80,
          reasoningScore: 80,
          clarityScore: 85,
          summary: 'Accurate description of growing and shrinking phases.',
          strengths: ['Clear phase distinction.'],
          improvements: ['Discuss cascading aborts.'],
          sampleAnswer: '2PL reference answer...',
        },
        {
          questionId: mockQuestions[2].id,
          orderIndex: 3,
          correctnessScore: 95,
          completenessScore: 85,
          reasoningScore: 90,
          clarityScore: 90,
          summary: 'Good comparison of read vs write trade-offs.',
          strengths: ['Correctly identified write amplification.'],
          improvements: ['Detail compaction strategies in LSM.'],
          sampleAnswer: 'B+ Tree vs LSM reference answer...',
        },
      ],
      crossInterviewAnalysis: {
        recurringStrengths: ['Consistent understanding of storage layer trade-offs.'],
        weakTopics: ['Recovery edge cases and compaction overhead.'],
        repeatedErrors: [],
        recommendations: ['Elaborate on production failure recovery mechanisms.'],
        practiceAreas: ['DBMS Storage Engines'],
      },
    };

    const payload = validateBatchEvaluationPayload(rawModelOutput, {
      interviewId: mockInterview.id,
      type: mockInterview.type,
      difficulty: mockInterview.difficulty,
      focusArea: mockInterview.focusArea,
      questions: mockQuestions.map((q, idx) => ({
        questionId: q.id,
        orderIndex: q.orderIndex,
        questionText: q.questionText,
        answerText: mockAnswers[idx].answerText,
      })),
    });

    assert.strictEqual(payload.questions.length, 3);
    // Question 1: 100*0.4 + 90*0.25 + 85*0.2 + 90*0.15 = 40 + 22.5 + 17 + 13.5 = 93
    assert.strictEqual(payload.questions[0].overallScore, 93);
    // Question 2: 90*0.4 + 80*0.25 + 80*0.2 + 85*0.15 = 36 + 20 + 16 + 12.75 = 84.75 => 85
    assert.strictEqual(payload.questions[1].overallScore, 85);
    // Question 3: 95*0.4 + 85*0.25 + 90*0.2 + 90*0.15 = 38 + 21.25 + 18 + 13.5 = 90.75 => 91
    assert.strictEqual(payload.questions[2].overallScore, 91);

    // Overall interview score = round((93 + 85 + 91) / 3) = round(269 / 3) = 90
    assert.strictEqual(payload.overallScore, 90);
    assert.strictEqual(payload.performanceLevel, 'Advanced');
    assert.strictEqual(payload.crossInterviewAnalysis.recurringStrengths.length, 1);
  });

  it('rejects batch evaluation report generation if interview is not completed', async () => {
    mock.method(db.orm.public.Interview, 'first', async () => ({
      ...mockInterview,
      status: 'IN_PROGRESS',
    }));
    mock.method(db.orm.public.Question, 'where', () => ({
      all: async () => mockQuestions,
    }));
    // Only 2 of 3 questions answered
    mock.method(db.orm.public.Answer, 'where', () => ({
      all: async () => [mockAnswers[0], mockAnswers[1]],
    }));

    await assert.rejects(
      evaluationService.generateEvaluationReport(mockInterview.id),
      (err: any) =>
        err.code === 'BAD_REQUEST' &&
        err.message.includes('Interview is not completed. 2 of 3 questions have been answered.')
    );
  });

  it('returns cached completed report on repeated POST without invoking Gemini', async () => {
    const existingReport = {
      id: 'rep-1',
      interviewId: mockInterview.id,
      status: 'COMPLETED',
      overallScore: 92,
      performanceLevel: 'Advanced',
      summary: 'Cached report summary.',
      questionsEvaluated: 3,
      reportPayload: {
        summary: 'Cached report summary.',
        overallScore: 92,
        questions: [],
      },
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      all: async () => mockQuestions,
    }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      all: async () => mockAnswers,
    }));

    let geminiCalls = 0;
    mock.method(gemini.models, 'generateContent', async () => {
      geminiCalls++;
      return { text: '{}' };
    });

    mock.method(db, 'transaction', async (cb: any) => {
      const mockTx = {
        orm: {
          public: {
            EvaluationReport: {
              where: () => ({
                first: async () => existingReport,
              }),
            },
          },
        },
      };
      return cb(mockTx);
    });

    const report = await evaluationService.generateEvaluationReport(mockInterview.id);

    assert.strictEqual(report.id, 'rep-1');
    assert.strictEqual(report.status, 'COMPLETED');
    assert.strictEqual(report.overallScore, 92);
    assert.strictEqual(geminiCalls, 0, 'Gemini must not be called when a completed report already exists');
  });

  it('retrieves stored report via GET without invoking Gemini', async () => {
    const existingReport = {
      id: 'rep-123',
      interviewId: mockInterview.id,
      status: 'COMPLETED',
      overallScore: 88,
      performanceLevel: 'Advanced',
      summary: 'Report retrieved via GET.',
      questionsEvaluated: 3,
      reportPayload: {
        summary: 'Report retrieved via GET.',
        overallScore: 88,
        questions: [],
      },
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.EvaluationReport, 'where', () => ({
      first: async () => existingReport,
    }));

    let geminiCalls = 0;
    mock.method(gemini.models, 'generateContent', async () => {
      geminiCalls++;
      return { text: '{}' };
    });

    const report = await evaluationService.getEvaluationReport(mockInterview.id);

    assert(report !== null);
    assert.strictEqual(report.id, 'rep-123');
    assert.strictEqual(report.overallScore, 88);
    assert.strictEqual(geminiCalls, 0, 'GET must never call Gemini');
  });

  it('rejects concurrent generation attempts with 409 Conflict when report is already PENDING', async () => {
    const activePending = {
      id: 'rep-pending',
      interviewId: mockInterview.id,
      status: 'PENDING',
      updatedAt: new Date(), // Just started (< 90s)
    };

    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      all: async () => mockQuestions,
    }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      all: async () => mockAnswers,
    }));

    mock.method(db, 'transaction', async (cb: any) => {
      const mockTx = {
        orm: {
          public: {
            EvaluationReport: {
              where: () => ({
                first: async () => activePending,
              }),
            },
          },
        },
      };
      return cb(mockTx);
    });

    await assert.rejects(
      evaluationService.generateEvaluationReport(mockInterview.id),
      (err: any) =>
        err.code === 'CONFLICT' &&
        err.message.includes('Evaluation report is currently being generated')
    );
  });

  it('generates report in exactly one batched Gemini request and persists it', async () => {
    let capturedPrompt = '';
    let geminiCalls = 0;

    mock.method(gemini.models, 'generateContent', async (args: any) => {
      geminiCalls++;
      capturedPrompt = args.contents;
      return {
        text: JSON.stringify({
          summary: 'Candidate demonstrated thorough knowledge across all DBMS questions.',
          questions: [
            {
              questionId: mockQuestions[0].id,
              orderIndex: 1,
              correctnessScore: 95,
              completenessScore: 90,
              reasoningScore: 85,
              clarityScore: 90,
              summary: 'Accurate explanation of WAL.',
              strengths: ['Correct durability semantics.'],
              improvements: ['Detail log sequence numbers (LSN).'],
              sampleAnswer: 'Model WAL answer...',
            },
            {
              questionId: mockQuestions[1].id,
              orderIndex: 2,
              correctnessScore: 90,
              completenessScore: 90,
              reasoningScore: 85,
              clarityScore: 90,
              summary: 'Solid 2PL definition.',
              strengths: ['Clear explanation of lock acquisition.'],
              improvements: ['Mention deadlock prevention.'],
              sampleAnswer: 'Model 2PL answer...',
            },
            {
              questionId: mockQuestions[2].id,
              orderIndex: 3,
              correctnessScore: 95,
              completenessScore: 95,
              reasoningScore: 90,
              clarityScore: 90,
              summary: 'Great B+ tree vs LSM tree contrast.',
              strengths: ['Thorough coverage of random vs sequential I/O.'],
              improvements: ['Discuss Bloom filter usage in LSM.'],
              sampleAnswer: 'Model tree answer...',
            },
          ],
          crossInterviewAnalysis: {
            recurringStrengths: ['Deep understanding of database concurrency and persistence.'],
            weakTopics: ['Deadlock resolution mechanics.'],
            repeatedErrors: [],
            recommendations: ['Explore distributed transaction coordination.'],
            practiceAreas: ['Distributed Systems'],
          },
        }),
      };
    });

    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      all: async () => mockQuestions,
    }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      all: async () => mockAnswers,
    }));

    const persistedReport = {
      id: 'rep-new',
      interviewId: mockInterview.id,
      status: 'COMPLETED',
      overallScore: 91,
      performanceLevel: 'Advanced',
      summary: 'Candidate demonstrated thorough knowledge across all DBMS questions.',
      questionsEvaluated: 3,
      reportPayload: {},
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mock.method(db, 'transaction', async (cb: any) => {
      const mockTx = {
        orm: {
          public: {
            Interview: {
              where: () => ({ update: async () => {} }),
            },
            EvaluationReport: {
              where: () => ({
                first: async () => null,
                update: async () => {},
              }),
              create: async (data: any) => ({ ...data, id: 'rep-new', updatedAt: new Date() }),
            },
            Evaluation: {
              where: () => ({
                first: async () => null,
                update: async () => {},
              }),
              create: async () => {},
            },
          },
        },
      };
      const res = await cb(mockTx);
      // If returning from second transaction, return completed report
      return res || persistedReport;
    });

    const report = await evaluationService.generateEvaluationReport(mockInterview.id);

    assert.strictEqual(geminiCalls, 1, 'Exactly one batched Gemini request must be executed');
    assert(capturedPrompt.includes('Question 1 (ID: 11111111-1111-1111-1111-111111111111)'));
    assert(capturedPrompt.includes('Question 2 (ID: 22222222-2222-2222-2222-222222222222)'));
    assert(capturedPrompt.includes('Question 3 (ID: 33333333-3333-3333-3333-333333333333)'));
    assert.strictEqual(report.status, 'COMPLETED');
  });

  it('handles provider failure gracefully, preserves answers, sets FAILED status, and supports retry', async () => {
    mock.method(gemini.models, 'generateContent', async () => {
      throw new Error('Gemini quota exceeded');
    });

    mock.method(db.orm.public.Interview, 'first', async () => mockInterview);
    mock.method(db.orm.public.Question, 'where', () => ({
      all: async () => mockQuestions,
    }));
    mock.method(db.orm.public.Answer, 'where', () => ({
      all: async () => mockAnswers,
    }));

    let updatedToFailed = false;

    mock.method(db, 'transaction', async (cb: any) => {
      const mockTx = {
        orm: {
          public: {
            Interview: {
              where: () => ({ update: async () => {} }),
            },
            EvaluationReport: {
              where: () => ({
                first: async () => null,
                update: async (fields: any) => {
                  if (fields.status === 'FAILED') {
                    updatedToFailed = true;
                  }
                },
              }),
              create: async (data: any) => ({ ...data, id: 'rep-failed', updatedAt: new Date() }),
            },
          },
        },
      };
      return cb(mockTx);
    });

    await assert.rejects(
      evaluationService.generateEvaluationReport(mockInterview.id),
      (err: any) => err.code === 'PROVIDER_ERROR' || err.code === 'RATE_LIMITED' || err.code === 'PROVIDER_UNAVAILABLE'
    );

    assert.strictEqual(updatedToFailed, true, 'Report must be marked FAILED on model failure to support retry');
  });

  it('sanitizeProviderError correctly sanitizes 503, 429, network, and raw JSON errors', async () => {
    const { sanitizeProviderError } = await import('./evaluation.service.js');

    // 1. Raw JSON 503 provider error
    const raw503 = '{"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}';
    const res503 = sanitizeProviderError(new Error(raw503));
    assert.strictEqual(res503.statusCode, 503);
    assert.strictEqual(res503.code, 'PROVIDER_UNAVAILABLE');
    assert.strictEqual(res503.message, 'The AI service is temporarily busy. Your answers are saved. Please try again shortly.');

    // 2. 429 quota / rate limit error
    const raw429 = '{"error":{"code":429,"message":"Resource exhausted: quota exceeded","status":"RESOURCE_EXHAUSTED"}}';
    const res429 = sanitizeProviderError(new Error(raw429));
    assert.strictEqual(res429.statusCode, 429);
    assert.strictEqual(res429.code, 'RATE_LIMITED');
    assert.strictEqual(res429.message, 'The AI evaluation service has reached a usage limit. Your answers are saved; please try again later.');

    // 3. Network connection failure
    const netErr = new Error('connect ECONNREFUSED 127.0.0.1:4000');
    const resNet = sanitizeProviderError(netErr);
    assert.strictEqual(resNet.message, "We couldn't reach the evaluation service. Your answers remain saved.");

    // 4. Generic internal failure
    const genericErr = new Error('Unexpected token');
    const resGeneric = sanitizeProviderError(genericErr);
    assert.strictEqual(resGeneric.message, 'AI evaluation service temporarily unavailable. Please try again.');
  });
});
