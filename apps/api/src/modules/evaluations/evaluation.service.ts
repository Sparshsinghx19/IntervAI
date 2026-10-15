import { db } from '../../prisma/db.js';
import { aiEvaluatorService } from './ai-evaluator.service.js';
import { EvaluationResponse, EvaluationReportResponse } from './evaluation.types.js';

export function formatEvaluationReportResponse(report: any): EvaluationReportResponse {
  let parsedPayload = report.reportPayload;
  if (typeof parsedPayload === 'string') {
    try {
      parsedPayload = JSON.parse(parsedPayload);
    } catch {
      parsedPayload = null;
    }
  }

  return {
    id: report.id,
    interviewId: report.interviewId,
    status: report.status,
    overallScore: report.overallScore ?? null,
    performanceLevel: report.performanceLevel ?? null,
    summary: report.summary ?? null,
    questionsEvaluated: report.questionsEvaluated ?? null,
    reportPayload: parsedPayload ?? null,
    errorMessage: report.errorMessage ?? null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

export function formatEvaluationResponse(evaluation: any): EvaluationResponse {

  const parseJsonField = (val: any): string[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [val];
      }
    }
    return [];
  };

  return {
    id: evaluation.id,
    answerId: evaluation.answerId,
    status: evaluation.status,
    correctnessScore: evaluation.correctnessScore ?? 0,
    completenessScore: evaluation.completenessScore ?? 0,
    reasoningScore: evaluation.reasoningScore ?? 0,
    clarityScore: evaluation.clarityScore ?? 0,
    overallScore: evaluation.overallScore ?? 0,
    summary: evaluation.summary ?? '',
    strengths: parseJsonField(evaluation.strengths),
    improvements: parseJsonField(evaluation.improvements),
    sampleAnswer: evaluation.sampleAnswer ?? '',
    createdAt: evaluation.createdAt,
    updatedAt: evaluation.updatedAt,
  };
}

export function sanitizeProviderError(error: any): { message: string; statusCode: number; code: string } {
  const rawMsg = error?.message || String(error || '');
  let parsedCode = error?.status || error?.statusCode || 0;
  let parsedMsg = rawMsg;
  let statusStr = '';

  try {
    const json = JSON.parse(rawMsg);
    if (json && typeof json === 'object') {
      const err = json.error || json;
      if (typeof err === 'object') {
        parsedCode = err.code || err.status || parsedCode;
        parsedMsg = err.message || parsedMsg;
        statusStr = String(err.status || '');
      }
    }
  } catch {
    // not JSON
  }

  const combined = `${parsedMsg} ${rawMsg} ${statusStr}`.toLowerCase();

  if (
    parsedCode === 503 ||
    statusStr === '503' ||
    statusStr === 'UNAVAILABLE' ||
    combined.includes('503') ||
    combined.includes('high demand') ||
    combined.includes('temporarily busy') ||
    combined.includes('unavailable') ||
    combined.includes('overloaded') ||
    combined.includes('spikes in demand')
  ) {
    return {
      message: 'The AI service is temporarily busy. Your answers are saved. Please try again shortly.',
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    };
  }

  if (
    parsedCode === 429 ||
    statusStr === '429' ||
    statusStr === 'RESOURCE_EXHAUSTED' ||
    combined.includes('429') ||
    combined.includes('quota') ||
    combined.includes('rate limit') ||
    combined.includes('resource_exhausted') ||
    combined.includes('too many requests')
  ) {
    return {
      message: 'The AI evaluation service has reached a usage limit. Your answers are saved; please try again later.',
      statusCode: 429,
      code: 'RATE_LIMITED',
    };
  }

  if (combined.includes('econnrefused') || combined.includes('network') || combined.includes('fetch') || combined.includes('connection refused')) {
    return {
      message: "We couldn't reach the evaluation service. Your answers remain saved.",
      statusCode: 503,
      code: 'NETWORK_ERROR',
    };
  }

  return {
    message: 'AI evaluation service temporarily unavailable. Please try again.',
    statusCode: 503,
    code: 'PROVIDER_ERROR',
  };
}

export const evaluationService = {
  getEvaluation: async (interviewId: string, questionId: string): Promise<EvaluationResponse | null> => {
    const interview = await db.orm.public.Interview.first({ id: interviewId });
    if (!interview) {
      const error = new Error('Interview not found');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    const question = await db.orm.public.Question.where({ id: questionId }).first();
    if (!question || question.interviewId !== interviewId) {
      const error = new Error('Question not found or does not belong to this interview');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    const answer = await db.orm.public.Answer.where({ questionId }).first();
    if (!answer) {
      const error = new Error('No answer found for this question');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    const evaluation = await db.orm.public.Evaluation.where({ answerId: answer.id }).first();
    if (!evaluation) {
      return null;
    }

    return formatEvaluationResponse(evaluation);
  },

  evaluateAnswer: async (interviewId: string, questionId: string): Promise<EvaluationResponse> => {
    // Phase 1: Validate Interview, Question, and Answer
    const interview = await db.orm.public.Interview.first({ id: interviewId });
    if (!interview) {
      const error = new Error('Interview not found');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    const question = await db.orm.public.Question.where({ id: questionId }).first();
    if (!question || question.interviewId !== interviewId) {
      const error = new Error('Question not found or does not belong to this interview');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    const answer = await db.orm.public.Answer.where({ questionId }).first();
    if (!answer) {
      const error = new Error('No answer found for this question');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    // Phase 2: Claim PENDING state in a short database transaction
    // Protect against duplicate concurrent requests
    const claim = await db.transaction(async (tx) => {
      const existing = await tx.orm.public.Evaluation.where({ answerId: answer.id }).first();

      if (existing) {
        // If already completed, return cached evaluation (ZERO Gemini calls)
        if (existing.status === 'COMPLETED') {
          return { shouldEvaluate: false, evaluation: existing };
        }

        // If currently in progress, check staleness (60 second threshold)
        if (existing.status === 'PENDING') {
          const ageMs = Date.now() - new Date(existing.updatedAt).getTime();
          if (ageMs < 60000) {
            const conflictErr = new Error('Evaluation is currently in progress for this answer');
            (conflictErr as any).code = 'CONFLICT';
            throw conflictErr;
          }
        }

        // Claim pending state for retry on FAILED or stale PENDING
        await tx.orm.public.Evaluation.where({ id: existing.id }).update({
          status: 'PENDING',
        });
        const updated = await tx.orm.public.Evaluation.where({ id: existing.id }).first();
        return { shouldEvaluate: true, evaluation: updated! };
      }

      // Create new initial PENDING evaluation
      const created = await tx.orm.public.Evaluation.create({
        answerId: answer.id,
        status: 'PENDING',
      });
      return { shouldEvaluate: true, evaluation: created };
    });

    if (!claim.shouldEvaluate) {
      return formatEvaluationResponse(claim.evaluation);
    }

    // Phase 3: Invoke AI Evaluator outside the database transaction
    let aiResult;
    try {
      aiResult = await aiEvaluatorService.evaluate({
        questionText: question.questionText,
        topic: interview.focusArea,
        difficulty: interview.difficulty,
        answerText: answer.answerText,
      });
    } catch (evalError: any) {
      // Mark as FAILED in a short DB transaction so it can be retried safely
      try {
        await db.transaction(async (tx) => {
          await tx.orm.public.Evaluation.where({ id: claim.evaluation.id }).update({
            status: 'FAILED',
          });
        });
      } catch (dbErr) {
        console.error('Failed to update evaluation status to FAILED:', dbErr);
      }

      const providerError = new Error('AI evaluation service temporarily unavailable. Please try again.');
      (providerError as any).code = 'PROVIDER_ERROR';
      (providerError as any).cause = evalError?.message;
      throw providerError;
    }

    // Phase 4: Persist evaluation result in a short database transaction
    await db.transaction(async (tx) => {
      await tx.orm.public.Evaluation.where({ id: claim.evaluation.id }).update({
        status: 'COMPLETED',
        correctnessScore: aiResult.correctnessScore,
        completenessScore: aiResult.completenessScore,
        reasoningScore: aiResult.reasoningScore,
        clarityScore: aiResult.clarityScore,
        overallScore: aiResult.overallScore,
        summary: aiResult.summary,
        strengths: aiResult.strengths,
        improvements: aiResult.improvements,
        sampleAnswer: aiResult.sampleAnswer,
      });
    });

    const completed = await db.orm.public.Evaluation.where({ id: claim.evaluation.id }).first();
    return formatEvaluationResponse(completed || claim.evaluation);
  },

  getEvaluationReport: async (interviewId: string): Promise<EvaluationReportResponse | null> => {
    const interview = await db.orm.public.Interview.first({ id: interviewId });
    if (!interview) {
      const error = new Error('Interview not found');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    const report = await db.orm.public.EvaluationReport.where({ interviewId }).first();
    if (!report) {
      return null;
    }

    return formatEvaluationReportResponse(report);
  },

  generateEvaluationReport: async (interviewId: string): Promise<EvaluationReportResponse> => {
    // Phase 1: Validate Interview
    const interview = await db.orm.public.Interview.first({ id: interviewId });
    if (!interview) {
      const error = new Error('Interview not found');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    // Load questions and answers
    const rawQuestions = await db.orm.public.Question
      .where({ interviewId })
      .all();

    const questions = rawQuestions.sort((a, b) => a.orderIndex - b.orderIndex);


    if (questions.length === 0) {
      const error = new Error('No questions found for this interview');
      (error as any).code = 'BAD_REQUEST';
      throw error;
    }

    const questionIds = questions.map((q) => q.id);
    const answers = await db.orm.public.Answer
      .where((a) => a.questionId.in(questionIds))
      .all();

    const answersByQuestionId = new Map<string, any>();
    for (const ans of answers) {
      answersByQuestionId.set(ans.questionId, ans);
    }

    // Completion policy check: all questions in the interview must have been answered
    if (answers.length < interview.questionCount) {
      const error = new Error(
        `Interview is not completed. ${answers.length} of ${interview.questionCount} questions have been answered.`
      );
      (error as any).code = 'BAD_REQUEST';
      throw error;
    }

    // Ensure interview status is marked COMPLETED if not already
    if (interview.status !== 'COMPLETED') {
      await db.transaction(async (tx) => {
        await tx.orm.public.Interview.where({ id: interviewId }).update({ status: 'COMPLETED' });
      });
    }

    // Phase 2: Claim PENDING state atomically in a short DB transaction
    const claim = await db.transaction(async (tx) => {
      const existing = await tx.orm.public.EvaluationReport.where({ interviewId }).first();

      if (existing) {
        // Cached completed report -> return immediately (ZERO model calls)
        if (existing.status === 'COMPLETED') {
          return { shouldGenerate: false, report: existing };
        }

        // Active pending report check (90s staleness threshold)
        if (existing.status === 'PENDING') {
          const ageMs = Date.now() - new Date(existing.updatedAt).getTime();
          if (ageMs < 90000) {
            const conflictErr = new Error('Evaluation report is currently being generated for this interview');
            (conflictErr as any).code = 'CONFLICT';
            throw conflictErr;
          }
        }

        // Re-claim pending on retry or stale state
        await tx.orm.public.EvaluationReport.where({ id: existing.id }).update({
          status: 'PENDING',
          errorMessage: null,
        });
        const updated = await tx.orm.public.EvaluationReport.where({ id: existing.id }).first();
        return { shouldGenerate: true, report: updated! };
      }

      // Create new initial PENDING report record
      const created = await tx.orm.public.EvaluationReport.create({
        interviewId,
        status: 'PENDING',
      });
      return { shouldGenerate: true, report: created };
    });

    if (!claim.shouldGenerate) {
      return formatEvaluationReportResponse(claim.report);
    }

    // Phase 3: Invoke Gemini Batch Evaluator outside the database transaction
    const batchQuestions = questions.map((q) => {
      const ans = answersByQuestionId.get(q.id);
      return {
        questionId: q.id,
        orderIndex: q.orderIndex,
        questionText: q.questionText,
        answerText: ans ? ans.answerText : '',
      };
    });

    let reportPayload;
    try {
      reportPayload = await aiEvaluatorService.evaluateBatch({
        interviewId,
        type: interview.type,
        difficulty: interview.difficulty,
        focusArea: interview.focusArea,
        questions: batchQuestions,
      });
    } catch (evalError: any) {
      const sanitized = sanitizeProviderError(evalError);
      // Mark as FAILED in short DB transaction so it can be retried safely
      try {
        await db.transaction(async (tx) => {
          await tx.orm.public.EvaluationReport.where({ id: claim.report.id }).update({
            status: 'FAILED',
            errorMessage: sanitized.message,
          });
        });
      } catch (dbErr) {
        console.error('Failed to update evaluation report to FAILED:', dbErr);
      }
      const providerError = new Error(sanitized.message);
      (providerError as any).code = sanitized.code;
      (providerError as any).statusCode = sanitized.statusCode;
      throw providerError;
    }

    // Phase 4: Persist completed report and sync per-answer evaluations in a short DB transaction
    const completed = await db.transaction(async (tx) => {
      await tx.orm.public.EvaluationReport.where({ id: claim.report.id }).update({
        status: 'COMPLETED',
        overallScore: reportPayload.overallScore,
        performanceLevel: reportPayload.performanceLevel,
        summary: reportPayload.summary,
        questionsEvaluated: reportPayload.questions.length,
        reportPayload: reportPayload as any,
        errorMessage: null,
      });


      // Synchronize per-question evaluation records in Evaluation table
      for (const eq of reportPayload.questions) {
        const ans = answersByQuestionId.get(eq.questionId);
        if (ans) {
          const existingEval = await tx.orm.public.Evaluation.where({ answerId: ans.id }).first();
          if (existingEval) {
            await tx.orm.public.Evaluation.where({ id: existingEval.id }).update({
              status: 'COMPLETED',
              correctnessScore: eq.correctnessScore,
              completenessScore: eq.completenessScore,
              reasoningScore: eq.reasoningScore,
              clarityScore: eq.clarityScore,
              overallScore: eq.overallScore,
              summary: eq.summary,
              strengths: eq.strengths,
              improvements: eq.improvements,
              sampleAnswer: eq.sampleAnswer,
            });
          } else {
            await tx.orm.public.Evaluation.create({
              answerId: ans.id,
              status: 'COMPLETED',
              correctnessScore: eq.correctnessScore,
              completenessScore: eq.completenessScore,
              reasoningScore: eq.reasoningScore,
              clarityScore: eq.clarityScore,
              overallScore: eq.overallScore,
              summary: eq.summary,
              strengths: eq.strengths,
              improvements: eq.improvements,
              sampleAnswer: eq.sampleAnswer,
            });
          }
        }
      }

      return await tx.orm.public.EvaluationReport.where({ id: claim.report.id }).first();
    });

    return formatEvaluationReportResponse(completed!);
  },
};

