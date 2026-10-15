import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  aiEvaluatorService,
  calculateOverallScore,
  cleanJsonText,
  validateEvaluationPayload,
  RUBRIC_WEIGHTS,
} from './ai-evaluator.service.js';
import { gemini } from '../../infrastructure/gemini.js';

describe('AI Evaluator Service - Rubric & Logic', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('correctly calculates weighted overall score and rounds mathematically', () => {
    // 80 * 0.40 = 32
    // 70 * 0.25 = 17.5
    // 90 * 0.20 = 18
    // 85 * 0.15 = 12.75
    // Total = 32 + 17.5 + 18 + 12.75 = 80.25 => 80
    const score1 = calculateOverallScore({
      correctnessScore: 80,
      completenessScore: 70,
      reasoningScore: 90,
      clarityScore: 85,
    });
    assert.strictEqual(score1, 80);

    // Perfect score: 100 * 1.0 = 100
    const perfect = calculateOverallScore({
      correctnessScore: 100,
      completenessScore: 100,
      reasoningScore: 100,
      clarityScore: 100,
    });
    assert.strictEqual(perfect, 100);

    // Zero score: 0
    const zero = calculateOverallScore({
      correctnessScore: 0,
      completenessScore: 0,
      reasoningScore: 0,
      clarityScore: 0,
    });
    assert.strictEqual(zero, 0);

    // Rounding up: 75 * 0.4 = 30; 75 * 0.25 = 18.75; 80 * 0.2 = 16; 75 * 0.15 = 11.25
    // Sum = 30 + 18.75 + 16 + 11.25 = 76.0 => 76
    const score2 = calculateOverallScore({
      correctnessScore: 75,
      completenessScore: 75,
      reasoningScore: 80,
      clarityScore: 75,
    });
    assert.strictEqual(score2, 76);
  });

  it('verifies exact rubric weights', () => {
    assert.strictEqual(RUBRIC_WEIGHTS.CORRECTNESS, 0.40);
    assert.strictEqual(RUBRIC_WEIGHTS.COMPLETENESS, 0.25);
    assert.strictEqual(RUBRIC_WEIGHTS.REASONING, 0.20);
    assert.strictEqual(RUBRIC_WEIGHTS.CLARITY, 0.15);
    const sum =
      RUBRIC_WEIGHTS.CORRECTNESS +
      RUBRIC_WEIGHTS.COMPLETENESS +
      RUBRIC_WEIGHTS.REASONING +
      RUBRIC_WEIGHTS.CLARITY;
    assert.strictEqual(Math.round(sum * 100), 100);
  });

  it('strips markdown code blocks correctly', () => {
    const raw = '```json\n{"correctnessScore": 90}\n```';
    assert.strictEqual(cleanJsonText(raw), '{"correctnessScore": 90}');

    const plain = '{"correctnessScore": 90}';
    assert.strictEqual(cleanJsonText(plain), '{"correctnessScore": 90}');
  });

  it('validates and clamps score bounds', () => {
    const payload = {
      correctnessScore: 120, // should clamp to 100
      completenessScore: -15, // should clamp to 0
      reasoningScore: 85.6, // should round to 86
      clarityScore: 70,
      summary: 'Solid answer.',
      strengths: ['Good depth'],
      improvements: ['Address edge cases'],
      sampleAnswer: 'Ideal response outline',
    };

    const validated = validateEvaluationPayload(payload);
    assert.strictEqual(validated.correctnessScore, 100);
    assert.strictEqual(validated.completenessScore, 0);
    assert.strictEqual(validated.reasoningScore, 86);
    assert.strictEqual(validated.clarityScore, 70);
    // 100*0.4 + 0*0.25 + 86*0.2 + 70*0.15 = 40 + 0 + 17.2 + 10.5 = 67.7 => 68
    assert.strictEqual(validated.overallScore, 68);
    assert.strictEqual(validated.summary, 'Solid answer.');
    assert.deepStrictEqual(validated.strengths, ['Good depth']);
    assert.deepStrictEqual(validated.improvements, ['Address edge cases']);
    assert.strictEqual(validated.sampleAnswer, 'Ideal response outline');
  });

  it('rejects missing sampleAnswer or non-numeric scores', () => {
    assert.throws(
      () =>
        validateEvaluationPayload({
          correctnessScore: 'invalid',
          completenessScore: 50,
          reasoningScore: 50,
          clarityScore: 50,
          sampleAnswer: 'Outline',
        }),
      /Invalid score for correctnessScore/
    );

    assert.throws(
      () =>
        validateEvaluationPayload({
          correctnessScore: 80,
          completenessScore: 80,
          reasoningScore: 80,
          clarityScore: 80,
          // sampleAnswer missing
        }),
      /missing sampleAnswer or answerOutline/
    );
  });

  it('handles empty or whitespace-only answer safely without calling Gemini', async () => {
    const generateMock = mock.method(gemini.models, 'generateContent', async () => {
      throw new Error('Should not be called for empty answer');
    });

    const result = await aiEvaluatorService.evaluate({
      questionText: 'Explain virtual memory in operating systems.',
      topic: 'OS',
      difficulty: 'MEDIUM',
      answerText: '   ',
    });

    assert.strictEqual(generateMock.mock.callCount(), 0);
    assert.strictEqual(result.overallScore, 0);
    assert.strictEqual(result.correctnessScore, 0);
    assert.match(result.summary, /No response was provided/);
    assert.ok(result.sampleAnswer.length > 0);
  });

  it('evaluates valid response via Gemini with zero live API calls', async () => {
    const mockModelResponse = {
      correctnessScore: 85,
      completenessScore: 80,
      reasoningScore: 90,
      clarityScore: 85,
      overallScore: 999, // Should be ignored and recalculated by backend
      summary: 'Demonstrates a strong conceptual understanding of virtual memory.',
      strengths: ['Accurate explanation of paging', 'Clear description of page faults'],
      improvements: ['Could mention TLB miss penalties in detail'],
      sampleAnswer: 'Virtual memory provides an abstraction of main memory using paging and page tables...',
    };

    const generateMock = mock.method(gemini.models, 'generateContent', async () => ({
      text: JSON.stringify(mockModelResponse),
    }));

    const result = await aiEvaluatorService.evaluate({
      questionText: 'Explain virtual memory in operating systems.',
      topic: 'OS',
      difficulty: 'MEDIUM',
      answerText: 'Virtual memory maps virtual addresses to physical frames using page tables.',
    });

    assert.strictEqual(generateMock.mock.callCount(), 1);
    assert.strictEqual(result.correctnessScore, 85);
    assert.strictEqual(result.completenessScore, 80);
    assert.strictEqual(result.reasoningScore, 90);
    assert.strictEqual(result.clarityScore, 85);
    // 85*0.4 (34) + 80*0.25 (20) + 90*0.2 (18) + 85*0.15 (12.75) = 84.75 => 85
    assert.strictEqual(result.overallScore, 85);
    assert.strictEqual(result.summary, mockModelResponse.summary);
    assert.deepStrictEqual(result.strengths, mockModelResponse.strengths);
    assert.deepStrictEqual(result.improvements, mockModelResponse.improvements);
  });

  it('propagates Gemini API failures properly', async () => {
    mock.method(gemini.models, 'generateContent', async () => {
      throw new Error('Gemini API quota exceeded or timeout');
    });

    await assert.rejects(
      aiEvaluatorService.evaluate({
        questionText: 'What is indexing in databases?',
        topic: 'DBMS',
        difficulty: 'EASY',
        answerText: 'Indexes speed up data retrieval.',
      }),
      /Gemini API quota exceeded or timeout/
    );
  });

  it('rejects malformed model JSON responses', async () => {
    mock.method(gemini.models, 'generateContent', async () => ({
      text: 'This is not valid JSON at all',
    }));

    await assert.rejects(
      aiEvaluatorService.evaluate({
        questionText: 'What is a B-Tree?',
        topic: 'DBMS',
        difficulty: 'MEDIUM',
        answerText: 'A self-balancing search tree.',
      }),
      /Failed to parse Gemini evaluation output as JSON/
    );
  });
});
