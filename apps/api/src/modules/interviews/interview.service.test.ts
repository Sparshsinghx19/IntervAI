import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { interviewService } from './interview.service.js';
import { gemini } from '../../infrastructure/gemini.js';
import { qdrant } from '../../infrastructure/qdrant.js';
import { db } from '../../prisma/db.js';

describe('Interview Service - Retrieval Integration', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  const mockDbTransaction = (txCallback: any) => {
    const mockTx = {
      sql: {
        public: {
          interview: {
            insert: () => ({
              returning: () => ({
                build: () => 'MOCK_PLAN'
              })
            })
          }
        }
      },
      query: async () => [{
        id: 'mock-uuid',
        type: 'TECHNICAL',
        difficulty: 'MEDIUM',
        focusArea: 'DSA',
        questionCount: 2,
        status: 'NOT_STARTED'
      }],
      orm: {
        public: {
          Question: {
            create: mock.fn(async () => {})
          }
        }
      }
    };
    return txCallback(mockTx);
  };

  it('uses successfully retrieved questions for supported technical topics', async () => {
    const dummyVector = Array(768).fill(0.1);
    
    mock.method(gemini.models, 'embedContent', async () => ({
      embeddings: [{ values: dummyVector }]
    }));

    const queryMock = mock.method(qdrant, 'query', async () => ({
      points: [
        { score: 0.9, payload: { questionId: 1, questionText: 'Retrieved Q1', topic: 'DSA', difficulty: 'MEDIUM' } },
        { score: 0.8, payload: { questionId: 2, questionText: 'Retrieved Q2', topic: 'DSA', difficulty: 'MEDIUM' } }
      ]
    }));

    mock.method(db, 'transaction', mockDbTransaction);

    await interviewService.createInterview({
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      focusArea: 'DSA',
      questionCount: 2
    });

    assert.strictEqual(queryMock.mock.callCount(), 1);
  });

  it('preserves existing generator for HR and behavioral interviews', async () => {
    const embedMock = mock.method(gemini.models, 'embedContent', async () => ({}));
    mock.method(db, 'transaction', mockDbTransaction);

    await interviewService.createInterview({
      type: 'HR',
      difficulty: 'MEDIUM',
      focusArea: 'Culture Fit',
      questionCount: 2
    });

    // Retrieval should never be called
    assert.strictEqual(embedMock.mock.callCount(), 0);
  });

  it('falls back to generator if retrieval returns fewer results than requested', async () => {
    const dummyVector = Array(768).fill(0.1);
    
    mock.method(gemini.models, 'embedContent', async () => ({
      embeddings: [{ values: dummyVector }]
    }));

    const queryMock = mock.method(qdrant, 'query', async () => ({
      points: [
        { score: 0.9, payload: { questionId: 1, questionText: 'Only 1 retrieved', topic: 'OS', difficulty: 'MEDIUM' } }
      ] // Requested 2
    }));

    mock.method(db, 'transaction', mockDbTransaction);

    const originalWarn = console.warn;
    let warningLogged = false;
    console.warn = () => { warningLogged = true; };

    await interviewService.createInterview({
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      focusArea: 'OS',
      questionCount: 2
    });

    console.warn = originalWarn;

    assert.strictEqual(queryMock.mock.callCount(), 1);
    assert.strictEqual(warningLogged, true);
  });

  it('falls back to generator safely on external API failure', async () => {
    const embedMock = mock.method(gemini.models, 'embedContent', async () => {
      throw new Error('Network timeout');
    });
    mock.method(db, 'transaction', mockDbTransaction);

    const originalWarn = console.warn;
    let warningLogged = false;
    console.warn = () => { warningLogged = true; };

    await interviewService.createInterview({
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      focusArea: 'DBMS',
      questionCount: 2
    });

    console.warn = originalWarn;

    assert.strictEqual(embedMock.mock.callCount(), 1);
    assert.strictEqual(warningLogged, true);
  });
});
