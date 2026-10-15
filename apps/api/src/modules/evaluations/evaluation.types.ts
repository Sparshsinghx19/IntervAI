export type EvaluationStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface CriterionScores {
  correctnessScore: number;
  completenessScore: number;
  reasoningScore: number;
  clarityScore: number;
}

export interface EvaluationResult extends CriterionScores {
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  sampleAnswer: string;
}

export interface EvaluateAnswerParams {
  questionText: string;
  topic: string;
  difficulty: string;
  answerText: string;
}

export interface EvaluationResponse extends EvaluationResult {
  id: string;
  answerId: string;
  status: EvaluationStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface QuestionEvaluationResult extends CriterionScores {
  questionId: string;
  questionText: string;
  orderIndex: number;
  candidateAnswer: string;
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  sampleAnswer: string;
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

export interface BatchEvaluateQuestionItem {
  questionId: string;
  orderIndex: number;
  questionText: string;
  answerText: string;
}

export interface BatchEvaluateParams {
  interviewId: string;
  type: string;
  difficulty: string;
  focusArea: string;
  questions: BatchEvaluateQuestionItem[];
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
  createdAt: Date | string;
  updatedAt: Date | string;
}

