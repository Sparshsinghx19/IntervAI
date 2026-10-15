import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { evaluationController } from './evaluation.controller.js';
import { evaluationService } from './evaluation.service.js';

describe('Evaluation Controller', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  const validInterviewId = '11111111-1111-1111-1111-111111111111';
  const validQuestionId = '22222222-2222-2222-2222-222222222222';

  const createMockRes = () => {
    const res: any = {
      statusCode: 200,
      jsonData: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.jsonData = data;
        return this;
      },
    };
    return res;
  };

  it('returns 400 if interviewId or questionId is missing or invalid UUID', async () => {
    const req1: any = { params: { interviewId: 'invalid-uuid', questionId: validQuestionId } };
    const res1 = createMockRes();
    await evaluationController.evaluateAnswer(req1, res1);
    assert.strictEqual(res1.statusCode, 400);
    assert.match(res1.jsonData.error, /Invalid UUID format/);

    const req2: any = { params: { interviewId: validInterviewId, questionId: 'invalid-uuid' } };
    const res2 = createMockRes();
    await evaluationController.evaluateAnswer(req2, res2);
    assert.strictEqual(res2.statusCode, 400);
    assert.match(res2.jsonData.error, /Invalid UUID format/);
  });

  it('returns 404 if evaluationService throws NOT_FOUND', async () => {
    mock.method(evaluationService, 'evaluateAnswer', async () => {
      const err = new Error('Question not found or does not belong to this interview');
      (err as any).code = 'NOT_FOUND';
      throw err;
    });

    const req: any = { params: { interviewId: validInterviewId, questionId: validQuestionId } };
    const res = createMockRes();
    await evaluationController.evaluateAnswer(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.match(res.jsonData.error, /Question not found/);
  });

  it('returns 409 if evaluationService throws CONFLICT', async () => {
    mock.method(evaluationService, 'evaluateAnswer', async () => {
      const err = new Error('Evaluation is currently in progress for this answer');
      (err as any).code = 'CONFLICT';
      throw err;
    });

    const req: any = { params: { interviewId: validInterviewId, questionId: validQuestionId } };
    const res = createMockRes();
    await evaluationController.evaluateAnswer(req, res);

    assert.strictEqual(res.statusCode, 409);
    assert.match(res.jsonData.error, /currently in progress/);
  });

  it('returns 503 if evaluationService throws PROVIDER_ERROR', async () => {
    mock.method(evaluationService, 'evaluateAnswer', async () => {
      const err = new Error('AI evaluation service temporarily unavailable. Please try again.');
      (err as any).code = 'PROVIDER_ERROR';
      throw err;
    });

    const req: any = { params: { interviewId: validInterviewId, questionId: validQuestionId } };
    const res = createMockRes();
    await evaluationController.evaluateAnswer(req, res);

    assert.strictEqual(res.statusCode, 503);
    assert.match(res.jsonData.error, /temporarily unavailable/);
  });

  it('returns 200 with evaluation data on successful evaluation', async () => {
    const mockEvaluation = {
      id: 'eval-uuid-1',
      answerId: 'ans-uuid-1',
      status: 'COMPLETED',
      correctnessScore: 90,
      completenessScore: 85,
      reasoningScore: 80,
      clarityScore: 90,
      overallScore: 87,
      summary: 'Solid answer.',
      strengths: ['Great technical depth'],
      improvements: ['Elaborate on edge cases'],
      sampleAnswer: 'Detailed outline...',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mock.method(evaluationService, 'evaluateAnswer', async () => mockEvaluation);

    const req: any = { params: { interviewId: validInterviewId, questionId: validQuestionId } };
    const res = createMockRes();
    await evaluationController.evaluateAnswer(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.jsonData, mockEvaluation);
  });

  it('getEvaluation returns 200 when evaluation exists, 404 when not found', async () => {
    mock.method(evaluationService, 'getEvaluation', async () => null);

    const reqNotFound: any = { params: { interviewId: validInterviewId, questionId: validQuestionId } };
    const resNotFound = createMockRes();
    await evaluationController.getEvaluation(reqNotFound, resNotFound);
    assert.strictEqual(resNotFound.statusCode, 404);

    const mockEvaluation = {
      id: 'eval-uuid-1',
      status: 'COMPLETED',
      overallScore: 90,
    };
    mock.method(evaluationService, 'getEvaluation', async () => mockEvaluation as any);

    const reqFound: any = { params: { interviewId: validInterviewId, questionId: validQuestionId } };
    const resFound = createMockRes();
    await evaluationController.getEvaluation(reqFound, resFound);
    assert.strictEqual(resFound.statusCode, 200);
    assert.deepStrictEqual(resFound.jsonData, mockEvaluation);
  });

  it('generateEvaluationReport returns 400 on invalid UUID', async () => {
    const req: any = { params: { interviewId: 'not-a-uuid' } };
    const res = createMockRes();
    await evaluationController.generateEvaluationReport(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.error, /Invalid UUID format/);
  });

  it('generateEvaluationReport returns 400 when interview is not completed', async () => {
    mock.method(evaluationService, 'generateEvaluationReport', async () => {
      const err = new Error('Interview is not completed. 1 of 5 questions have been answered.');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    });

    const req: any = { params: { interviewId: validInterviewId } };
    const res = createMockRes();
    await evaluationController.generateEvaluationReport(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.error, /Interview is not completed/);
  });

  it('generateEvaluationReport returns 200 on success', async () => {
    const mockReport = {
      id: 'rep-uuid-1',
      interviewId: validInterviewId,
      status: 'COMPLETED',
      overallScore: 92,
      performanceLevel: 'Advanced',
    };
    mock.method(evaluationService, 'generateEvaluationReport', async () => mockReport as any);

    const req: any = { params: { interviewId: validInterviewId } };
    const res = createMockRes();
    await evaluationController.generateEvaluationReport(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.jsonData, mockReport);
  });

  it('getEvaluationReport returns 200 when report exists, 404 when not found', async () => {
    mock.method(evaluationService, 'getEvaluationReport', async () => null);

    const reqNotFound: any = { params: { interviewId: validInterviewId } };
    const resNotFound = createMockRes();
    await evaluationController.getEvaluationReport(reqNotFound, resNotFound);
    assert.strictEqual(resNotFound.statusCode, 404);

    const mockReport = {
      id: 'rep-uuid-1',
      interviewId: validInterviewId,
      status: 'COMPLETED',
      overallScore: 89,
    };
    mock.method(evaluationService, 'getEvaluationReport', async () => mockReport as any);

    const reqFound: any = { params: { interviewId: validInterviewId } };
    const resFound = createMockRes();
    await evaluationController.getEvaluationReport(reqFound, resFound);
    assert.strictEqual(resFound.statusCode, 200);
    assert.deepStrictEqual(resFound.jsonData, mockReport);
  });
});

