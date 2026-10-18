export type QuestionType = 'THEORY' | 'CODING' | 'SYSTEM_DESIGN';
export type EvaluationStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface EvaluationResponse {
  id: string;
  answerId: string;
  status: EvaluationStatus;
  correctnessScore: number;
  completenessScore: number;
  reasoningScore: number;
  clarityScore: number;
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  sampleAnswer: string;
  createdAt: string;
  updatedAt: string;
}

export type EvaluationStage =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'evaluating'
  | 'completed'
  | 'save_error'
  | 'eval_error';

export interface QuestionEvaluationResult {
  questionId: string;
  questionText: string;
  /** Where the question came from (curated, subject research, resume, follow-up). */
  origin?: string;
  category?: string;
  /** Web sources that informed the question, when research supported it. */
  sources?: Array<{ id: string; title: string; url: string; domain: string; retrievedAt?: string }>;
  /** True when the time limit ended before this question was answered. */
  unanswered?: boolean;
  orderIndex: number;
  candidateAnswer: string;
  correctnessScore?: number;
  completenessScore?: number;
  reasoningScore?: number;
  clarityScore?: number;
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  sampleAnswer: string;
  questionType?: QuestionType | string;
  submissionStatus?: string;
  testsPassed?: number;
  totalTests?: number;
  language?: string;
  executionTimeMs?: number;
  memoryKb?: number;
}

export interface CrossInterviewAnalysis {
  recurringStrengths: string[];
  weakTopics: string[];
  repeatedErrors: string[];
  recommendations: string[];
  practiceAreas: string[];
}

export interface EvaluationReportPayload {
  interviewId: string;
  type: string;
  difficulty: string;
  focusArea: string;
  overallScore: number;
  performanceLevel: 'Expert' | 'Advanced' | 'Proficient' | 'Developing' | 'Needs Foundation';
  questionsAnswered: number;
  questionsEvaluated: number;
  summary: string;
  questions: QuestionEvaluationResult[];
  crossInterviewAnalysis: CrossInterviewAnalysis;
}

export interface EvaluationReportResponse {
  id: string;
  interviewId: string;
  status: EvaluationStatus;
  overallScore: number | null;
  performanceLevel: string | null;
  summary: string | null;
  questionsEvaluated: number | null;
  reportPayload: EvaluationReportPayload | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
