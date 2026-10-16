export type SupportedLanguage = 'cpp' | 'python' | 'java';

export interface CodingProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface PublicCodingProblem {
  slug: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  category?: string;
  topic?: string;
  description: string;
  constraints?: string[];
  examples: CodingProblemExample[];
  starterCode: Record<SupportedLanguage, string>;
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

export interface RawJudge0SubmissionResult {
  token: string;
  statusId: number;
  statusDescription: string;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  time?: string | null;
  memory?: number | null;
}
