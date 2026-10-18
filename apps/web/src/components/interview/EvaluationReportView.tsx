'use client';

import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  BookOpen,
  ArrowRight,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Target,
  Sparkles,
  Layers,
  Copy,
  Check,
  Compass,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  EvaluationReportResponse,
  EvaluationReportPayload,
  QuestionEvaluationResult,
} from '@/types/evaluation';
import { formatSafeEvaluationErrorMessage } from '@/lib/evaluation-api';
import { questionOriginLabel } from '@/lib/adaptive-setup';
import { SourcesDisclosure } from './SourcesDisclosure';

interface EvaluationReportViewProps {
  report: EvaluationReportResponse | null;
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
  onReturnToSetup: () => void;
}

export function EvaluationReportView({
  report,
  isLoading,
  error,
  onRetry,
  onReturnToSetup,
}: EvaluationReportViewProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({
    '0': true, // Expand first question by default
  });
  const [copiedQuestionId, setCopiedQuestionId] = useState<string | null>(null);

  const toggleQuestion = (id: string) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopyModelAnswer = (questionId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestionId(questionId);
    setTimeout(() => setCopiedQuestionId(null), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return { text: 'text-emerald-400', stroke: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    if (score >= 70) return { text: 'text-cyan-400', stroke: '#06b6d4', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
    if (score >= 55) return { text: 'text-brand-300', stroke: '#8b5cf6', bg: 'bg-brand-500/10', border: 'border-brand-500/30' };
    return { text: 'text-amber-400', stroke: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  };

  const getPerformanceBadge = (level: string = 'Proficient') => {
    switch (level?.toUpperCase()) {
      case 'EXPERT':
        return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30';
      case 'ADVANCED':
        return 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30';
      case 'PROFICIENT':
        return 'text-brand-300 bg-brand-500/15 border-brand-500/30';
      case 'DEVELOPING':
        return 'text-amber-300 bg-amber-500/15 border-amber-500/30';
      default:
        return 'text-rose-300 bg-rose-500/15 border-rose-500/30';
    }
  };

  // 1. Loading State
  if (isLoading || report?.status === 'PENDING') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px] p-6">
        <Card className="glass-card max-w-lg w-full p-8 sm:p-10 border-brand-500/20 text-center space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-[spin_1s_linear_infinite]" />
            <div className="absolute inset-1.5 rounded-full border-b-2 border-brand-400 animate-[spin_1.5s_linear_infinite_reverse]" />
            <div className="w-full h-full rounded-full bg-brand-500/10 flex items-center justify-center text-cyan-300">
              <BrainCircuit className="w-8 h-8 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Generating Evaluation Report</h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              Our AI is analyzing your responses across all questions, evaluating technical accuracy, completeness, reasoning depth, and synthesis.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-brand-300/80 bg-brand-950/40 py-2 px-4 rounded-full border border-brand-500/20 max-w-xs mx-auto">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>Analyzing holistic strengths & gaps...</span>
          </div>
        </Card>
      </div>
    );
  }

  // 2. Error State
  if (error || report?.status === 'FAILED') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px] p-6">
        <Card className="glass-card max-w-lg w-full p-8 sm:p-10 border-amber-500/30 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Report Generation Notice</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {formatSafeEvaluationErrorMessage(error || report?.errorMessage)}
            </p>
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3 text-xs text-emerald-300 mt-2">
              <CheckCircle2 className="w-4 h-4 inline-block mr-1.5 text-emerald-400" />
              All your submitted interview answers are securely saved in the database.
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-center">
            <Button
              variant="glow"
              onClick={onRetry}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Report Generation
            </Button>
            <Button
              variant="outline"
              onClick={onReturnToSetup}
              className="border-white/10 hover:bg-white/5"
            >
              Return to Setup
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 3. Completed Report Display
  const payload: EvaluationReportPayload | null = report?.reportPayload || null;
  const overallScore = report?.overallScore ?? payload?.overallScore ?? 0;
  const performanceLevel = report?.performanceLevel ?? payload?.performanceLevel ?? 'Proficient';
  const overallStyle = getScoreColor(overallScore);
  const questions = payload?.questions || [];
  const cross = payload?.crossInterviewAnalysis;

  // SVG circle calculation
  const circleRadius = 46;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-8 max-w-[1400px] mx-auto w-full">
      {/* ---------------------------------------------------- */}
      {/* Hero Overview Card                                   */}
      {/* ---------------------------------------------------- */}
      <Card className="glass-card-strong p-6 sm:p-8 border-brand-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left: Title & Overview Details */}
          <div className="space-y-4 max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" />
              <span>Interview Evaluation Report</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Comprehensive Performance Summary
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {payload?.summary || report?.summary || 'Detailed batch evaluation of your complete technical interview session.'}
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-1">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPerformanceBadge(performanceLevel)}`}>
                Performance: {performanceLevel}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-slate-300">
                Focus: <strong className="text-white capitalize">{payload?.focusArea || 'Technical'}</strong>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-slate-300">
                Difficulty: <strong className="text-white capitalize">{payload?.difficulty || 'Medium'}</strong>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-slate-300">
                Questions Evaluated: <strong className="text-white">{questions.length}</strong>
              </span>
            </div>
          </div>

          {/* Right: Circular Score Gauge */}
          <div className="flex flex-col items-center shrink-0">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 110 110">
                <circle
                  cx="55"
                  cy="55"
                  r={circleRadius}
                  className="text-white/10"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="55"
                  cy="55"
                  r={circleRadius}
                  stroke={overallStyle.stroke}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className={`text-4xl font-extrabold tracking-tight ${overallStyle.text}`}>
                  {overallScore}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                  out of 100
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-400 mt-2 font-medium">Weighted Composite Score</span>
          </div>
        </div>
      </Card>

      {/* ---------------------------------------------------- */}
      {/* Cross-Interview Synthesis Card                       */}
      {/* ---------------------------------------------------- */}
      {cross && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recurring Strengths */}
          <Card className="glass-card p-6 border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Recurring Strengths</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc list-inside">
              {cross.recurringStrengths.map((str, idx) => (
                <li key={idx} className="pl-1">{str}</li>
              ))}
            </ul>
          </Card>

          {/* Key Improvement Recommendations */}
          <Card className="glass-card p-6 border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-brand-300 font-semibold text-sm">
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>Prioritized Recommendations</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc list-inside">
              {cross.recommendations.map((rec, idx) => (
                <li key={idx} className="pl-1">{rec}</li>
              ))}
            </ul>
          </Card>

          {/* Weak Topics or Conceptual Gaps */}
          {cross.weakTopics && cross.weakTopics.length > 0 && (
            <Card className="glass-card p-6 border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <Lightbulb className="w-4 h-4 shrink-0" />
                <span>Areas for Conceptual Deepening</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc list-inside">
                {cross.weakTopics.map((topic, idx) => (
                  <li key={idx} className="pl-1">{topic}</li>
                ))}
              </ul>
            </Card>
          )}

          {/* Suggested Practice Topics */}
          {cross.practiceAreas && cross.practiceAreas.length > 0 && (
            <Card className="glass-card p-6 border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                <Compass className="w-4 h-4 shrink-0" />
                <span>Suggested Practice Focus</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {cross.practiceAreas.map((area, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-950/30 border border-cyan-500/20 text-cyan-300"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* Question-by-Question Detailed Results List           */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-400" />
            <h2 className="text-xl font-bold text-white">Question Breakdowns</h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {questions.length} questions evaluated
          </span>
        </div>

        <div className="space-y-4">
          {questions.map((q: QuestionEvaluationResult, index: number) => {
            const isExpanded = !!expandedQuestions[String(index)];
            const qScoreStyle = getScoreColor(q.overallScore);

            const criteria = [
              { label: 'Correctness', weight: '40%', score: q.correctnessScore },
              { label: 'Completeness', weight: '25%', score: q.completenessScore },
              { label: 'Reasoning', weight: '20%', score: q.reasoningScore },
              { label: 'Clarity', weight: '15%', score: q.clarityScore },
            ];

            return (
              <Card
                key={q.questionId || index}
                className="glass-card border-white/10 overflow-hidden transition-all duration-300"
              >
                {/* Header / Summary Bar */}
                <button
                  type="button"
                  onClick={() => toggleQuestion(String(index))}
                  className="w-full text-left p-5 flex items-start sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                        Q{index + 1}
                      </span>
                      <span className="text-xs text-slate-400">Order #{q.orderIndex}</span>
                      {questionOriginLabel(q.origin, q.category, Boolean(q.sources?.length)) && (
                        <span className="hidden sm:inline text-[11px] text-cyan-200/90 bg-cyan-500/10 border border-cyan-400/20 px-2 py-0.5 rounded-full">
                          {questionOriginLabel(q.origin, q.category, Boolean(q.sources?.length))}
                        </span>
                      )}
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-white truncate">
                      {q.questionText}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className={`text-lg font-bold font-mono ${qScoreStyle.text}`}>
                        {q.overallScore}
                        <span className="text-xs text-slate-500 font-normal">/100</span>
                      </div>
                    </div>
                    <div className="p-1 rounded-md bg-white/5 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </button>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-white/5 space-y-6 bg-black/10">
                    {/* Sources that informed this question (only when stored provenance exists) */}
                    <SourcesDisclosure sources={q.sources} />

                    {/* Evaluator Summary */}
                    <p className="text-sm text-slate-300 leading-relaxed italic bg-white/[0.02] p-3 rounded-lg border border-white/5">
                      "{q.summary}"
                    </p>

                    {/* Question Breakdown: Objective Coding Execution or Rubric Dimensions */}
                    {q.questionType === 'CODING' || q.submissionStatus ? (
                      <div>
                        <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3">
                          Execution Results
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                            <span className="text-xs font-medium text-slate-400">Submission Status</span>
                            <div className="pt-1">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold font-mono ${
                                  q.submissionStatus === 'ACCEPTED'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {q.submissionStatus || 'NOT_SUBMITTED'}
                              </span>
                            </div>
                          </div>

                          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                            <span className="text-xs font-medium text-slate-400">Test Cases Passed</span>
                            <div className="text-xl font-bold font-mono text-cyan-400">
                              {q.testsPassed ?? 0}
                              <span className="text-xs text-slate-500 font-normal"> / {q.totalTests ?? 0}</span>
                            </div>
                          </div>

                          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                            <span className="text-xs font-medium text-slate-400">Language</span>
                            <div className="text-base font-bold font-mono text-brand-300 uppercase">
                              {q.language || 'N/A'}
                            </div>
                          </div>

                          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                            <span className="text-xs font-medium text-slate-400">Runtime / Memory</span>
                            <div className="text-xs font-mono text-slate-300 pt-1">
                              {q.executionTimeMs != null ? `${q.executionTimeMs} ms` : 'N/A'}
                              {q.memoryKb != null ? ` / ${Math.round(q.memoryKb / 1024)} MB` : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3">
                          Rubric Dimensions
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {criteria.map((crit, cIdx) => {
                            const cStyle = getScoreColor(crit.score ?? 0);
                            return (
                              <div
                                key={cIdx}
                                className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2"
                              >
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-medium text-slate-300">{crit.label}</span>
                                  <span className="text-[10px] text-slate-500">{crit.weight}</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                  <span className={`text-xl font-bold font-mono ${cStyle.text}`}>
                                    {crit.score ?? 0}
                                  </span>
                                  <span className="text-[10px] text-slate-500">/100</span>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 rounded-full ${
                                      (crit.score ?? 0) >= 80 ? 'bg-emerald-400' : (crit.score ?? 0) >= 60 ? 'bg-cyan-400' : 'bg-amber-400'
                                    }`}
                                    style={{ width: `${crit.score ?? 0}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Candidate Answer / Code Box */}
                    {q.candidateAnswer && (
                      <div className="space-y-1.5">
                        <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                          {q.questionType === 'CODING' ? 'Your Submitted Code' : 'Your Submitted Answer'}
                        </span>
                        <div
                          className={`bg-white/5 rounded-lg p-3 text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap border border-white/5 ${
                            q.questionType === 'CODING' ? 'font-mono' : 'font-sans'
                          }`}
                        >
                          {q.candidateAnswer}
                        </div>
                      </div>
                    )}

                    {/* Strengths & Improvements */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.strengths && q.strengths.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Strengths Observed</span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside bg-emerald-950/10 p-3 rounded-lg border border-emerald-500/10">
                            {q.strengths.map((str, sIdx) => (
                              <li key={sIdx}>{str}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {q.improvements && q.improvements.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Actionable Improvements</span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside bg-amber-950/10 p-3 rounded-lg border border-amber-500/10">
                            {q.improvements.map((imp, iIdx) => (
                              <li key={iIdx}>{imp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Reference / Model Answer */}
                    {q.sampleAnswer && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-brand-300 text-xs font-semibold">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Reference Model Answer</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyModelAnswer(q.questionId, q.sampleAnswer)}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                          >
                            {copiedQuestionId === q.questionId ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Reference</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="bg-brand-950/20 border border-brand-500/20 rounded-xl p-4 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {q.sampleAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* Bottom Actions Bar                                   */}
      {/* ---------------------------------------------------- */}
      <div className="pt-4 pb-8 flex items-center justify-between border-t border-white/10">
        <Button
          variant="outline"
          onClick={onReturnToSetup}
          className="border-white/10 hover:bg-white/5"
        >
          Return to Setup
        </Button>
        <Button
          variant="glow"
          onClick={onReturnToSetup}
          className="gap-2"
        >
          Start Another Interview
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
