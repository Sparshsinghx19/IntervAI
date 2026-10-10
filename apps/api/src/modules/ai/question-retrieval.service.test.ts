import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { retrieveQuestions } from './question-retrieval.service.js';
import { gemini } from '../../infrastructure/gemini.js';
import { qdrant } from '../../infrastructure/qdrant.js';

describe('Question Retrieval Service', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('rejects empty queries', async () => {
    await assert.rejects(
      retrieveQuestions({ query: '   ', limit: 5 }),
      /Search query must not be empty/
    );
  });

  it('rejects invalid limits', async () => {
    await assert.rejects(
      retrieveQuestions({ query: 'test', limit: -1 }),
      /Limit must be a positive integer/
    );
  });

  it('handles empty Qdrant results', async () => {
    const dummyVector = Array(768).fill(0.1);
    
    mock.method(gemini.models, 'embedContent', async () => ({
      embeddings: [{ values: dummyVector }]
    }));

    mock.method(qdrant, 'query', async () => ({
      points: []
    }));

    const results = await retrieveQuestions({ query: 'unknown concept', limit: 5 });
    assert.deepStrictEqual(results, []);
  });

  it('applies topic and difficulty filters and maps payloads correctly', async () => {
    const dummyVector = Array(768).fill(0.1);
    
    let receivedSearchRequest: any;

    mock.method(gemini.models, 'embedContent', async () => ({
      embeddings: [{ values: dummyVector }]
    }));

    mock.method(qdrant, 'query', async (_collection: string, request: any) => {
      receivedSearchRequest = request;
      return {
        points: [
          {
            score: 0.85,
            payload: {
              questionId: 42,
              questionText: 'Mocked Question?',
              topic: 'DSA',
              subtopic: 'Arrays',
              difficulty: 'HARD',
              tags: ['mock']
            }
          }
        ]
      };
    });

    const results = await retrieveQuestions({
      query: 'find arrays',
      topic: 'DSA',
      difficulty: 'HARD',
      limit: 3
    });

    // Verify filters
    assert.ok(receivedSearchRequest.filter);
    assert.strictEqual(receivedSearchRequest.filter.must.length, 2);
    assert.strictEqual(receivedSearchRequest.limit, 3);
    assert.strictEqual(receivedSearchRequest.with_payload, true);
    assert.strictEqual(receivedSearchRequest.with_vector, false);

    // Verify mapping
    assert.strictEqual(results.length, 1);
    const first = results[0];
    assert.strictEqual(first.id, 42);
    assert.strictEqual(first.questionText, 'Mocked Question?');
    assert.strictEqual(first.topic, 'DSA');
    assert.strictEqual(first.difficulty, 'HARD');
    assert.strictEqual(first.score, 0.85);
  });

  it('propagates embedding API errors', async () => {
    mock.method(gemini.models, 'embedContent', async () => {
      throw new Error('Gemini API Timeout');
    });

    await assert.rejects(
      retrieveQuestions({ query: 'test', limit: 5 }),
      /Gemini API Timeout/
    );
  });

  it('propagates Qdrant API errors', async () => {
    const dummyVector = Array(768).fill(0.1);
    
    mock.method(gemini.models, 'embedContent', async () => ({
      embeddings: [{ values: dummyVector }]
    }));

    mock.method(qdrant, 'query', async () => {
      throw new Error('Qdrant Connection Refused');
    });

    await assert.rejects(
      retrieveQuestions({ query: 'test', limit: 5 }),
      /Qdrant Connection Refused/
    );
  });
});
