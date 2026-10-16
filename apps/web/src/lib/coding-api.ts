export interface CodingProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface PublicCodingProblem {
  slug: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | string;
  category?: string;
  topic?: string;
  description: string;
  constraints?: string[];
  examples: CodingProblemExample[];
  starterCode: Record<string, string>;
  hasHiddenTests: boolean;
}

export interface TestCaseResult {
  label: string;
  passed: boolean;
  status: string;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  executionTimeMs?: number;
  memoryKb?: number;
  errorMessage?: string;
}

export interface HiddenTestCaseResult {
  label: string;
  passed: boolean;
  status: string;
  executionTimeMs?: number;
  memoryKb?: number;
}

export interface RunCodeResponse {
  overallStatus: string;
  testsPassed: number;
  totalTests: number;
  results: TestCaseResult[];
  compileOutput?: string;
  stderr?: string;
}

export interface SubmitCodeResponse {
  submissionId: string;
  status: string;
  testsPassed: number;
  totalTests: number;
  executionTimeMs?: number;
  memoryKb?: number;
  publicResults: TestCaseResult[];
  hiddenResults: HiddenTestCaseResult[];
  compileOutput?: string;
  stderr?: string;
  sourceCode: string;
  language: string;
}

export function formatSafeRunnerErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred during execution.';

  const message = typeof error === 'string'
    ? error
    : error instanceof Error
    ? error.message
    : (error && typeof error === 'object' && 'message' in error)
    ? String((error as { message: unknown }).message)
    : '';

  if (message.includes('ECONNREFUSED') || message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Unable to connect to the execution runner service. Please ensure the backend and runner are active.';
  }

  if (message.includes('unavailable') || message.includes('not configured')) {
    return 'Code execution runner is currently unavailable. Please check the runner configuration.';
  }

  if (message.includes('capacity') || message.includes('queue') || message.includes('429')) {
    return 'Execution runner queue is currently busy. Please wait a moment and try again.';
  }

  return message || 'An error occurred during code execution.';
}


export async function fetchCodingProblem({
  interviewId,
  questionId,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
}: {
  interviewId: string;
  questionId: string;
  apiUrl?: string;
}): Promise<{ supported: boolean; problem?: PublicCodingProblem; error?: string }> {
  try {
    const res = await fetch(`${apiUrl}/api/interviews/${interviewId}/questions/${questionId}/coding-problem`);
    const data = await res.json();

    if (!res.ok) {
      return {
        supported: false,
        error: data.error || `Failed to fetch problem metadata (${res.status})`,
      };
    }

    return {
      supported: data.supported ?? true,
      problem: data.problem,
      error: data.error,
    };
  } catch (err: unknown) {
    return {
      supported: false,
      error: formatSafeRunnerErrorMessage(err),
    };
  }
}


export async function runCode({
  interviewId,
  questionId,
  language,
  sourceCode,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
}: {
  interviewId: string;
  questionId: string;
  language: string;
  sourceCode: string;
  apiUrl?: string;
}): Promise<{ success: boolean; result?: RunCodeResponse; error?: string }> {
  try {
    const res = await fetch(`${apiUrl}/api/interviews/${interviewId}/questions/${questionId}/code/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, sourceCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Execution failed with status ${res.status}`,
      };
    }

    return {
      success: true,
      result: data,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: formatSafeRunnerErrorMessage(err),
    };
  }
}

export async function submitCode({
  interviewId,
  questionId,
  language,
  sourceCode,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
}: {
  interviewId: string;
  questionId: string;
  language: string;
  sourceCode: string;
  apiUrl?: string;
}): Promise<{ success: boolean; result?: SubmitCodeResponse; error?: string }> {
  try {
    const res = await fetch(`${apiUrl}/api/interviews/${interviewId}/questions/${questionId}/code/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, sourceCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Submission failed with status ${res.status}`,
      };
    }

    return {
      success: true,
      result: data,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: formatSafeRunnerErrorMessage(err),
    };
  }
}
