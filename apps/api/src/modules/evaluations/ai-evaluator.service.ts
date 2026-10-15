import { gemini } from '../../infrastructure/gemini.js';
import { envConfig } from '../../config/env.js';
import {
  CriterionScores,
  EvaluateAnswerParams,
  EvaluationResult,
  BatchEvaluateParams,
  EvaluationReportPayload,
  QuestionEvaluationResult,
  CrossInterviewAnalysis,
} from './evaluation.types.js';

export const RUBRIC_WEIGHTS = {
  CORRECTNESS: 0.40,
  COMPLETENESS: 0.25,
  REASONING: 0.20,
  CLARITY: 0.15,
} as const;

export function calculateOverallScore(scores: CriterionScores): number {
  const weighted =
    scores.correctnessScore * RUBRIC_WEIGHTS.CORRECTNESS +
    scores.completenessScore * RUBRIC_WEIGHTS.COMPLETENESS +
    scores.reasoningScore * RUBRIC_WEIGHTS.REASONING +
    scores.clarityScore * RUBRIC_WEIGHTS.CLARITY;

  return Math.min(100, Math.max(0, Math.round(weighted)));
}

export function calculateInterviewOverallScore(questionScores: number[]): number {
  if (!questionScores || questionScores.length === 0) return 0;
  const total = questionScores.reduce((acc, curr) => acc + curr, 0);
  return Math.min(100, Math.max(0, Math.round(total / questionScores.length)));
}

export function determinePerformanceLevel(
  score: number
): 'Expert' | 'Advanced' | 'Proficient' | 'Developing' | 'Needs Foundation' {
  if (score >= 95) return 'Expert';
  if (score >= 85) return 'Advanced';
  if (score >= 70) return 'Proficient';
  if (score >= 55) return 'Developing';
  return 'Needs Foundation';
}

export function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

function clampScore(val: unknown, name: string): number {
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num) || !isFinite(num)) {
    throw new Error(`Invalid score for ${name}: must be a finite number`);
  }
  const rounded = Math.round(num);
  return Math.min(100, Math.max(0, rounded));
}

function sanitizeStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    return [val.trim()];
  }
  return [];
}

export function validateEvaluationPayload(raw: any): EvaluationResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Malformed evaluation response: expected a JSON object');
  }

  const correctnessScore = clampScore(raw.correctnessScore, 'correctnessScore');
  const completenessScore = clampScore(raw.completenessScore, 'completenessScore');
  const reasoningScore = clampScore(raw.reasoningScore, 'reasoningScore');
  const clarityScore = clampScore(raw.clarityScore, 'clarityScore');

  // Backend calculates the overall score according to the weighted rubric
  const overallScore = calculateOverallScore({
    correctnessScore,
    completenessScore,
    reasoningScore,
    clarityScore,
  });

  const summary = typeof raw.summary === 'string' && raw.summary.trim()
    ? raw.summary.trim()
    : 'Evaluation completed based on candidate response.';

  let strengths = sanitizeStringArray(raw.strengths);
  if (strengths.length === 0 && overallScore > 40) {
    strengths = ['Covered relevant aspects of the problem.'];
  }

  let improvements = sanitizeStringArray(raw.improvements);
  if (improvements.length === 0) {
    improvements = ['Continue elaborating on edge cases and concrete architectural trade-offs.'];
  }

  const sampleAnswer = typeof raw.sampleAnswer === 'string' && raw.sampleAnswer.trim()
    ? raw.sampleAnswer.trim()
    : (typeof raw.answerOutline === 'string' && raw.answerOutline.trim() ? raw.answerOutline.trim() : '');

  if (!sampleAnswer) {
    throw new Error('Malformed evaluation response: missing sampleAnswer or answerOutline');
  }

  return {
    correctnessScore,
    completenessScore,
    reasoningScore,
    clarityScore,
    overallScore,
    summary,
    strengths,
    improvements,
    sampleAnswer,
  };
}

export function validateBatchEvaluationPayload(
  raw: any,
  params: BatchEvaluateParams
): EvaluationReportPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Malformed batch evaluation response: expected a JSON object');
  }

  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  const evaluatedQuestions: QuestionEvaluationResult[] = [];

  for (const q of params.questions) {
    // Find matching question from model response by ID or orderIndex
    const match = rawQuestions.find(
      (item: any) =>
        String(item?.questionId) === q.questionId ||
        item?.orderIndex === q.orderIndex ||
        (typeof item?.questionText === 'string' && item.questionText.includes(q.questionText.slice(0, 30)))
    ) || {};

    const correctnessScore = clampScore(match.correctnessScore ?? 0, `question ${q.orderIndex} correctnessScore`);
    const completenessScore = clampScore(match.completenessScore ?? 0, `question ${q.orderIndex} completenessScore`);
    const reasoningScore = clampScore(match.reasoningScore ?? 0, `question ${q.orderIndex} reasoningScore`);
    const clarityScore = clampScore(match.clarityScore ?? 0, `question ${q.orderIndex} clarityScore`);

    const overallScore = calculateOverallScore({
      correctnessScore,
      completenessScore,
      reasoningScore,
      clarityScore,
    });

    const summary = typeof match.summary === 'string' && match.summary.trim()
      ? match.summary.trim()
      : `Evaluation for question ${q.orderIndex}.`;

    let strengths = sanitizeStringArray(match.strengths);
    if (strengths.length === 0 && overallScore > 40) {
      strengths = ['Addressed core components of the prompt accurately.'];
    }

    let improvements = sanitizeStringArray(match.improvements);
    if (improvements.length === 0) {
      improvements = ['Continue elaborating on concrete trade-offs and edge cases.'];
    }

    const sampleAnswer = typeof match.sampleAnswer === 'string' && match.sampleAnswer.trim()
      ? match.sampleAnswer.trim()
      : (typeof match.answerOutline === 'string' && match.answerOutline.trim()
          ? match.answerOutline.trim()
          : `A strong answer should detail the primary concepts and production trade-offs.`);

    evaluatedQuestions.push({
      questionId: q.questionId,
      questionText: q.questionText,
      orderIndex: q.orderIndex,
      candidateAnswer: q.answerText,
      correctnessScore,
      completenessScore,
      reasoningScore,
      clarityScore,
      overallScore,
      summary,
      strengths,
      improvements,
      sampleAnswer,
    });
  }

  const overallScore = calculateInterviewOverallScore(evaluatedQuestions.map((eq) => eq.overallScore));
  const performanceLevel = determinePerformanceLevel(overallScore);

  const summary = typeof raw.summary === 'string' && raw.summary.trim()
    ? raw.summary.trim()
    : `Candidate completed ${evaluatedQuestions.length} questions in this ${params.difficulty.toLowerCase()} ${params.focusArea} interview with an overall score of ${overallScore}%.`;

  const rawCross = raw.crossInterviewAnalysis || {};
  const crossInterviewAnalysis: CrossInterviewAnalysis = {
    recurringStrengths: sanitizeStringArray(rawCross.recurringStrengths).length > 0
      ? sanitizeStringArray(rawCross.recurringStrengths)
      : ['Solid conceptual foundation on answered topics.'],
    weakTopics: sanitizeStringArray(rawCross.weakTopics),
    repeatedErrors: sanitizeStringArray(rawCross.repeatedErrors),
    recommendations: sanitizeStringArray(rawCross.recommendations).length > 0
      ? sanitizeStringArray(rawCross.recommendations)
      : ['Deepen knowledge in architectural trade-offs and real-world system failure modes.'],
    practiceAreas: sanitizeStringArray(rawCross.practiceAreas).length > 0
      ? sanitizeStringArray(rawCross.practiceAreas)
      : [params.focusArea],
  };

  return {
    interviewId: params.interviewId,
    type: params.type,
    difficulty: params.difficulty,
    focusArea: params.focusArea,
    overallScore,
    performanceLevel,
    questionsAnswered: params.questions.filter((q) => q.answerText && q.answerText.trim().length > 0).length,
    questionsEvaluated: evaluatedQuestions.length,
    summary,
    questions: evaluatedQuestions,
    crossInterviewAnalysis,
  };
}

export const aiEvaluatorService = {
  evaluate: async (params: EvaluateAnswerParams): Promise<EvaluationResult> => {
    const trimmedAnswer = params.answerText ? params.answerText.trim() : '';

    // Handle empty or whitespace-only answers without an unnecessary model call
    if (!trimmedAnswer) {
      return {
        correctnessScore: 0,
        completenessScore: 0,
        reasoningScore: 0,
        clarityScore: 0,
        overallScore: 0,
        summary: 'No response was provided for this question.',
        strengths: [],
        improvements: [
          'Provide a detailed answer explaining the core technical concepts and trade-offs required by the question.'
        ],
        sampleAnswer: `A comprehensive answer for "${params.questionText}" should discuss the primary mechanisms, complexity or architectural trade-offs, and typical production considerations.`,
      };
    }

    // Guard against excessively large inputs (e.g. paste dumps)
    const MAX_ANSWER_CHARS = 15000;
    const sanitizedAnswer = trimmedAnswer.length > MAX_ANSWER_CHARS
      ? trimmedAnswer.slice(0, MAX_ANSWER_CHARS) + '\n[Truncated input at 15,000 characters]'
      : trimmedAnswer;

    const prompt = `You are an expert technical interviewer and educator evaluating a candidate's answer for an interview question.

Question: "${params.questionText}"
Topic / Focus Area: ${params.topic}
Difficulty Level: ${params.difficulty}

Candidate Answer:
"""
${sanitizedAnswer}
"""

Evaluation Guidelines:
1. Assess the candidate's answer against the actual question and difficulty level.
2. Accept technically valid alternative approaches, valid terminology synonyms, and different architectural choices.
3. Do not reward mere verbosity or length; concise, accurate answers with sound reasoning should score highly.
4. Do not invent required concepts or esoteric trivia that the prompt did not ask for.
5. Give partial credit when an answer is partly correct or addresses some components of the problem.
6. Provide constructive, balanced feedback without claiming AI evaluations are infallible.
7. Note on source code: This is an interview assessment. If the question asks for conceptual or theoretical explanation and the candidate merely dumps raw source code syntax without explanation, evaluate clarity and completeness accordingly.

Evaluate on these 4 rubric dimensions (0 to 100 integer scores):
- correctnessScore (40% weight): Accuracy of technical concepts, logic, and facts.
- completenessScore (25% weight): Depth and coverage of key requirements and edge cases.
- reasoningScore (20% weight): Explanation of "why", justification of trade-offs, and critical thinking.
- clarityScore (15% weight): Organization, readability, and communication quality.

Return a valid JSON object matching this exact schema:
{
  "correctnessScore": <integer 0-100>,
  "completenessScore": <integer 0-100>,
  "reasoningScore": <integer 0-100>,
  "clarityScore": <integer 0-100>,
  "summary": "<concise 2-4 sentence overall assessment>",
  "strengths": ["<positive observation 1>", "<positive observation 2>"],
  "improvements": ["<actionable improvement 1>", "<actionable improvement 2>"],
  "sampleAnswer": "<high-quality reference response or detailed outline that would achieve 100/100>"
}`;

    const response = await gemini.models.generateContent({
      model: envConfig.gemini.model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const responseText = response.text || '';
    if (!responseText.trim()) {
      throw new Error('Gemini returned an empty evaluation response');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJsonText(responseText));
    } catch (parseError: any) {
      throw new Error(`Failed to parse Gemini evaluation output as JSON: ${parseError.message}`);
    }

    return validateEvaluationPayload(parsed);
  },

  evaluateBatch: async (params: BatchEvaluateParams): Promise<EvaluationReportPayload> => {
    const MAX_ANSWER_CHARS = 10000;
    const formattedQuestions = params.questions.map((q) => {
      const trimmed = q.answerText ? q.answerText.trim() : '';
      const sanitized = trimmed.length > MAX_ANSWER_CHARS
        ? trimmed.slice(0, MAX_ANSWER_CHARS) + '\n[Truncated answer at 10,000 characters]'
        : trimmed || '[No answer submitted]';

      return `Question ${q.orderIndex} (ID: ${q.questionId}):
Prompt: "${q.questionText}"
Candidate Answer:
"""
${sanitized}
"""`;
    }).join('\n\n---\n\n');

    const prompt = `You are a principal technical interviewer evaluating a completed ${params.type} interview on ${params.focusArea} at ${params.difficulty} difficulty.

Below is the complete set of questions and the candidate's submitted responses in chronological order:

${formattedQuestions}

Evaluation Guidelines:
1. Evaluate each candidate answer in context of its corresponding question and difficulty level.
2. Accept technically valid alternative approaches, valid terminology synonyms, and different architectural choices.
3. Do not reward mere verbosity or length; concise, accurate answers with sound reasoning should score highly.
4. If an answer is marked "[No answer submitted]" or is empty/non-responsive, assign appropriate minimal or zero scores.
5. In addition to per-question evaluation, provide a holistic cross-interview analysis identifying recurring strengths, weak concepts, repeated errors, prioritized improvement recommendations, and suggested practice areas.

Evaluate each question on these 4 rubric dimensions (0 to 100 integer scores):
- correctnessScore (40% weight): Accuracy of technical concepts, logic, and facts.
- completenessScore (25% weight): Depth and coverage of key requirements and edge cases.
- reasoningScore (20% weight): Explanation of "why", justification of trade-offs, and critical thinking.
- clarityScore (15% weight): Organization, readability, and communication quality.

Return a valid JSON object matching this exact schema:
{
  "summary": "<concise 3-5 sentence overall assessment of candidate performance across the entire interview>",
  "questions": [
    {
      "questionId": "<matching question ID string>",
      "orderIndex": <integer index matching question>,
      "correctnessScore": <integer 0-100>,
      "completenessScore": <integer 0-100>,
      "reasoningScore": <integer 0-100>,
      "clarityScore": <integer 0-100>,
      "summary": "<2-3 sentence question-specific evaluation summary>",
      "strengths": ["<positive observation 1>", "<positive observation 2>"],
      "improvements": ["<actionable improvement 1>", "<actionable improvement 2>"],
      "sampleAnswer": "<high-quality reference response or detailed outline that would achieve 100/100>"
    }
  ],
  "crossInterviewAnalysis": {
    "recurringStrengths": ["<strength observed across multiple questions>"],
    "weakTopics": ["<specific concept or area where candidate lacked depth>"],
    "repeatedErrors": ["<repeated misconception or omission where evidenced>"],
    "recommendations": ["<prioritized recommendation 1>", "<prioritized recommendation 2>"],
    "practiceAreas": ["<suggested topic/area 1>", "<suggested topic/area 2>"]
  }
}`;

    const response = await gemini.models.generateContent({
      model: envConfig.gemini.model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const responseText = response.text || '';
    if (!responseText.trim()) {
      throw new Error('Gemini returned an empty batch evaluation response');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJsonText(responseText));
    } catch (parseError: any) {
      throw new Error(`Failed to parse Gemini batch evaluation output as JSON: ${parseError.message}`);
    }

    return validateBatchEvaluationPayload(parsed, params);
  },
};

