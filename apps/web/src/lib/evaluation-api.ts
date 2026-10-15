import { EvaluationResponse, EvaluationReportResponse } from '@/types/evaluation';

export interface SubmitEvaluationResult {
  success: boolean;
  stage: 'completed' | 'save_error' | 'eval_error';
  error?: string;
  evaluation?: EvaluationResponse;
  answerSaved?: boolean;
}

export interface RetryEvaluationResult {
  success: boolean;
  stage: 'completed' | 'eval_error';
  error?: string;
  evaluation?: EvaluationResponse;
}

export interface FetchEvaluationResult {
  found: boolean;
  evaluation?: EvaluationResponse;
  error?: string;
}

export async function submitAnswerAndEvaluate(params: {
  interviewId: string;
  questionId: string;
  answerText: string;
  apiUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<SubmitEvaluationResult> {
  const { interviewId, questionId, answerText, apiUrl = 'http://localhost:4000', fetchFn = fetch } = params;

  const trimmed = answerText.trim();
  if (!trimmed) {
    return {
      success: false,
      stage: 'save_error',
      error: 'Please provide a response before submitting.',
    };
  }

  // Step 1: Persist Answer
  try {
    const answerRes = await fetchFn(`${apiUrl}/api/interviews/${interviewId}/questions/${questionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerText: trimmed }),
    });

    // 409 Conflict means answer was already recorded in DB
    if (!answerRes.ok && answerRes.status !== 409) {
      return {
        success: false,
        stage: 'save_error',
        error: 'Unable to save your response to the server. Please check your connection and try again.',
      };
    }
  } catch {
    return {
      success: false,
      stage: 'save_error',
      error: 'Network error while saving response. Please check your connection and try again.',
    };
  }

  // Step 2: Request Evaluation (only called after Step 1 succeeds)
  try {
    const evalRes = await fetchFn(`${apiUrl}/api/interviews/${interviewId}/questions/${questionId}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!evalRes.ok) {
      return {
        success: false,
        stage: 'eval_error',
        error: 'Your answer was saved successfully, but AI evaluation could not be generated at this time.',
        answerSaved: true,
      };
    }

    const evaluation: EvaluationResponse = await evalRes.json();
    return {
      success: true,
      stage: 'completed',
      evaluation,
      answerSaved: true,
    };
  } catch {
    return {
      success: false,
      stage: 'eval_error',
      error: 'Network error during evaluation request. Your answer was saved.',
      answerSaved: true,
    };
  }
}

export async function retryEvaluation(params: {
  interviewId: string;
  questionId: string;
  apiUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<RetryEvaluationResult> {
  const { interviewId, questionId, apiUrl = 'http://localhost:4000', fetchFn = fetch } = params;

  try {
    const evalRes = await fetchFn(`${apiUrl}/api/interviews/${interviewId}/questions/${questionId}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!evalRes.ok) {
      return {
        success: false,
        stage: 'eval_error',
        error: 'Evaluation retry was unable to complete. Please try again.',
      };
    }

    const evaluation: EvaluationResponse = await evalRes.json();
    return {
      success: true,
      stage: 'completed',
      evaluation,
    };
  } catch {
    return {
      success: false,
      stage: 'eval_error',
      error: 'Network error during evaluation retry. Please try again.',
    };
  }
}

export async function fetchExistingEvaluation(params: {
  interviewId: string;
  questionId: string;
  apiUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<FetchEvaluationResult> {
  const { interviewId, questionId, apiUrl = 'http://localhost:4000', fetchFn = fetch } = params;

  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/${interviewId}/questions/${questionId}/evaluation`);

    if (res.ok) {
      const evaluation: EvaluationResponse = await res.json();
      return { found: true, evaluation };
    }

    if (res.status === 404) {
      return { found: false };
    }

    return { found: false, error: `Failed to fetch evaluation with status: ${res.status}` };
  } catch {
    return { found: false, error: 'Network error while checking evaluation.' };
  }
}

export interface SaveAnswerResult {
  success: boolean;
  error?: string;
}

export async function saveInterviewAnswer(params: {
  interviewId: string;
  questionId: string;
  answerText: string;
  apiUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<SaveAnswerResult> {
  const { interviewId, questionId, answerText, apiUrl = 'http://localhost:4000', fetchFn = fetch } = params;

  const trimmed = answerText.trim();
  if (!trimmed) {
    return {
      success: false,
      error: 'Please provide a response before submitting.',
    };
  }

  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/${interviewId}/questions/${questionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerText: trimmed }),
    });

    if (res.ok || res.status === 409) {
      return { success: true };
    }

    const data = await res.json().catch(() => ({}));
    return {
      success: false,
      error: data?.error || 'Unable to save your response to the server. Please check your connection and try again.',
    };
  } catch {
    return {
      success: false,
      error: 'Network error while saving response. Please check your connection and try again.',
    };
  }
}

export function formatSafeEvaluationErrorMessage(rawError: unknown, statusCode?: number): string {
  let message = '';
  let code = statusCode || 0;
  let statusStr = '';

  if (typeof rawError === 'string') {
    try {
      const parsed = JSON.parse(rawError);
      if (parsed && typeof parsed === 'object') {
        const errObj = parsed.error || parsed;
        if (typeof errObj === 'object') {
          code = errObj.code || errObj.status || code;
          message = errObj.message || errObj.error || '';
          statusStr = String(errObj.status || '');
        } else if (typeof errObj === 'string') {
          message = errObj;
        }
      } else {
        message = rawError;
      }
    } catch {
      message = rawError;
    }
  } else if (rawError && typeof rawError === 'object') {
    const errObj = (rawError as any).error || rawError;
    code = (errObj as any).code || (errObj as any).status || code;
    message = (errObj as any).message || (errObj as any).error || '';
    statusStr = String((errObj as any).status || '');
  }

  const combined = `${message} ${statusStr}`.toLowerCase();

  // 1. 503 / temporary provider unavailability
  if (
    code === 503 ||
    statusStr === '503' ||
    statusStr === 'UNAVAILABLE' ||
    combined.includes('503') ||
    combined.includes('high demand') ||
    combined.includes('temporarily busy') ||
    combined.includes('unavailable') ||
    combined.includes('overloaded') ||
    combined.includes('spikes in demand')
  ) {
    return 'The AI service is temporarily busy. Your answers are saved. Please try again shortly.';
  }

  // 2. 429 / quota or rate limit
  if (
    code === 429 ||
    statusStr === '429' ||
    statusStr === 'RESOURCE_EXHAUSTED' ||
    combined.includes('429') ||
    combined.includes('quota') ||
    combined.includes('rate limit') ||
    combined.includes('resource_exhausted') ||
    combined.includes('too many requests')
  ) {
    return 'The AI evaluation service has reached a usage limit. Your answers are saved; please try again later.';
  }

  // 3. Network failure
  if (
    code === 0 ||
    combined.includes('failed to fetch') ||
    combined.includes('networkerror') ||
    combined.includes('network error') ||
    combined.includes('econnrefused') ||
    combined.includes('could not connect') ||
    combined.includes("couldn't reach")
  ) {
    return "We couldn't reach the evaluation service. Your answers remain saved.";
  }

  // 4. Other failures
  return 'Failed to generate evaluation report. Your answers are safely stored. Please try again.';
}

export interface GenerateReportResult {
  success: boolean;
  report?: EvaluationReportResponse;
  error?: string;
  status?: number;
}

export async function generateEvaluationReport(params: {
  interviewId: string;
  apiUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<GenerateReportResult> {
  const { interviewId, apiUrl = 'http://localhost:4000', fetchFn = fetch } = params;

  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/${interviewId}/evaluation-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      const report: EvaluationReportResponse = await res.json();
      return { success: true, report, status: res.status };
    }

    const data = await res.json().catch(() => ({}));
    const rawError = data?.error || data?.message || data;
    const safeError = formatSafeEvaluationErrorMessage(rawError, res.status);
    return {
      success: false,
      error: safeError,
      status: res.status,
    };
  } catch (err: any) {
    const safeError = formatSafeEvaluationErrorMessage(err?.message || 'network error', 0);
    return {
      success: false,
      error: safeError,
    };
  }
}

export interface FetchReportResult {
  found: boolean;
  report?: EvaluationReportResponse;
  error?: string;
}

export async function fetchEvaluationReport(params: {
  interviewId: string;
  apiUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<FetchReportResult> {
  const { interviewId, apiUrl = 'http://localhost:4000', fetchFn = fetch } = params;

  try {
    const res = await fetchFn(`${apiUrl}/api/interviews/${interviewId}/evaluation-report`);

    if (res.ok) {
      const report: EvaluationReportResponse = await res.json();
      return { found: true, report };
    }

    if (res.status === 404) {
      return { found: false };
    }

    return { found: false, error: `Failed to fetch report with status: ${res.status}` };
  } catch {
    return { found: false, error: 'Network error while checking evaluation report.' };
  }
}

