import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { interviewController } from './interview.controller.js';
import { interviewService } from './interview.service.js';

describe('Interview Controller - createInterview', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

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
      }
    };
    return res;
  };

  it('returns 400 if required fields are missing', async () => {
    const req: any = { body: { type: 'TECHNICAL' } };
    const res = createMockRes();

    await interviewController.createInterview(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.error, /Missing required fields/);
  });

  it('returns 400 if questionCount is invalid', async () => {
    const req: any = {
      body: {
        type: 'TECHNICAL',
        difficulty: 'MEDIUM',
        focusArea: 'dsa',
        questionCount: -1
      }
    };
    const res = createMockRes();

    await interviewController.createInterview(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.error, /questionCount must be a positive integer/);
  });

  it('returns 400 if type is invalid', async () => {
    const req: any = {
      body: {
        type: 'INVALID_TYPE',
        difficulty: 'MEDIUM',
        focusArea: 'dsa',
        questionCount: 5
      }
    };
    const res = createMockRes();

    await interviewController.createInterview(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.error, /Invalid type/);
  });

  it('returns 503 if database connection is refused (ECONNREFUSED)', async () => {
    const dbError: any = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    dbError.code = 'ECONNREFUSED';

    mock.method(interviewService, 'createInterview', async () => {
      throw dbError;
    });

    const req: any = {
      body: {
        type: 'TECHNICAL',
        difficulty: 'MEDIUM',
        focusArea: 'dsa',
        questionCount: 5
      }
    };
    const res = createMockRes();

    await interviewController.createInterview(req, res);

    assert.strictEqual(res.statusCode, 503);
    assert.match(res.jsonData.error, /Database service is currently unavailable/);
  });

  it('returns 201 on successful interview creation', async () => {
    const mockCreated = {
      id: 'mock-session-id',
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      focusArea: 'dsa',
      questionCount: 5,
      status: 'NOT_STARTED'
    };

    mock.method(interviewService, 'createInterview', async () => mockCreated);

    const req: any = {
      body: {
        type: 'TECHNICAL',
        difficulty: 'MEDIUM',
        focusArea: 'dsa',
        questionCount: 5
      }
    };
    const res = createMockRes();

    await interviewController.createInterview(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.deepStrictEqual(res.jsonData, mockCreated);
  });
});
