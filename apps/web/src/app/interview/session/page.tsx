'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SkipForward,
  AlertCircle,
  RefreshCcw,
  Send,
  BrainCircuit,
  CheckCircle2,
  Code2,
  Type,
  Clock,
  CornerDownLeft,
  FileQuestion,
  Sparkles,
  RotateCcw
} from 'lucide-react';

import { Navbar } from '@/components/marketing/navbar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CodingWorkspace } from '@/components/interview/coding-workspace';
import { EvaluationReportView } from '@/components/interview/EvaluationReportView';
import { EvaluationStage, EvaluationReportResponse } from '@/types/evaluation';
import {
  saveInterviewAnswer,
  generateEvaluationReport,
  fetchEvaluationReport,
} from '@/lib/evaluation-api';


type AIStatus = 'LISTENING' | 'EVALUATING' | 'COMPLETED';

interface QuestionItem {
  id: string | number;
  questionText: string;
  type?: 'THEORY' | 'CODING' | 'SYSTEM_DESIGN';
  difficulty?: string;
  focusArea?: string;
  orderIndex?: number;
  examples?: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints?: string[];
  [key: string]: unknown;
}

function InterviewSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  // Config State
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(!id);
  const [error, setError] = useState(!id);
  const [errorMessage, setErrorMessage] = useState(!id ? 'No interview ID provided in URL.' : '');
  const [interviewType, setInterviewType] = useState<string>('');
  const [interviewDifficulty, setInterviewDifficulty] = useState<string>('MEDIUM');
  const [focusArea, setFocusArea] = useState<string>('');
  const [mode, setMode] = useState<'text' | 'code'>('text');

  // Session State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [validationError, setValidationError] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Evaluation & Report State
  const [savedAnswersByQuestion, setSavedAnswersByQuestion] = useState<Record<string, string>>({});
  const [evaluationStage, setEvaluationStage] = useState<EvaluationStage>('idle');
  const [evaluationError, setEvaluationError] = useState<string>('');

  // Consolidated Batch Evaluation Report State
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [evaluationReport, setEvaluationReport] = useState<EvaluationReportResponse | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string>('');

  // AI State
  const [aiStatus, setAiStatus] = useState<AIStatus>('LISTENING');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load or generate consolidated evaluation report
  const loadEvaluationReport = async () => {
    if (!id) return;
    setIsGeneratingReport(true);
    setReportError('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      // 1. First check if a completed evaluation report is already stored in the DB (cached GET, zero AI calls)
      const cached = await fetchEvaluationReport({ interviewId: id, apiUrl });
      if (cached.found && cached.report && cached.report.status === 'COMPLETED') {
        setEvaluationReport(cached.report);
        setIsGeneratingReport(false);
        return;
      }

      // 2. Generate batch report across all answered questions
      const result = await generateEvaluationReport({ interviewId: id, apiUrl });
      if (result.success && result.report) {
        setEvaluationReport(result.report);
        setIsGeneratingReport(false);
      } else {
        setReportError(result.error || 'Failed to generate evaluation report. Your answers are safely stored.');
        setIsGeneratingReport(false);
      }
    } catch (err: any) {
      console.error('Report generation error:', err);
      setReportError('Network error while generating evaluation report. Your answers are safely stored.');
      setIsGeneratingReport(false);
    }
  };

  // 1. Load questions and interview status on mount
  useEffect(() => {
    if (!id) {
      return;
    }

    const loadQuestions = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const [questionsRes, interviewRes] = await Promise.all([
          fetch(`${apiUrl}/api/interviews/${id}/questions`),
          fetch(`${apiUrl}/api/interviews/${id}`)
        ]);

        if (!questionsRes.ok || !interviewRes.ok) {
          setError(true);
          setErrorMessage(
            questionsRes.status === 404 || interviewRes.status === 404
              ? 'Interview not found.'
              : 'Failed to load session data.'
          );
          setIsLoaded(true);
          return;
        }

        const data = await questionsRes.json();
        const interviewData = await interviewRes.json();

        setQuestions(data.questions || []);
        setInterviewType(interviewData.type || '');
        setInterviewDifficulty(interviewData.difficulty || 'MEDIUM');
        setFocusArea(interviewData.focusArea || '');

        // If interview was already completed, automatically restore or display the final report
        if (interviewData.status === 'COMPLETED') {
          setIsInterviewComplete(true);
          setAiStatus('COMPLETED');
          loadEvaluationReport();
        }
      } catch (err) {
        console.error('Session load error:', err);
        setError(true);
        setErrorMessage('Could not connect to the server.');
      } finally {
        setIsLoaded(true);
      }
    };
    loadQuestions();
  }, [id]);

  // 2. Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoaded && !error && !isInterviewComplete) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoaded, error, isInterviewComplete]);

  const currentQuestion = questions[currentIndex];
  const currentQuestionId = currentQuestion ? String(currentQuestion.id) : '';
  const currentQuestionType = currentQuestion?.type || 'THEORY';
  const isCodingQuestion = currentQuestionType === 'CODING';
  const isFinalQuestion = questions.length > 0 && currentIndex === questions.length - 1;

  // Synchronize workspace mode based on the current question's explicit type:
  // For THEORY (and default): open Text Mode by default, no C++ starter code or Coding IDE toggle.
  // For CODING: show Monaco Coding IDE with C++, Python, Java.
  useEffect(() => {
    if (currentQuestion) {
      const qType = currentQuestion.type || 'THEORY';
      if (qType === 'CODING') {
        setMode('code');
      } else {
        setMode('text');
      }
    }
  }, [currentIndex, currentQuestion]);


  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff?.toUpperCase()) {
      case 'EASY':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'HARD':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  // If loading
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-obsidian text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          <span className="text-xs text-slate-400 font-medium">Loading interview environment...</span>
        </div>
      </div>
    );
  }

  // If missing/invalid config or questions
  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-obsidian text-foreground flex flex-col items-center justify-center p-4">
        <Navbar mode="session" />
        <Card className="glass-card max-w-md w-full p-8 text-center space-y-4 border-red-500/20">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-white">Session Unavailable</h2>
          <p className="text-sm text-slate-400">
            {errorMessage || 'Unable to initialize interview questions. Please return to setup and try again.'}
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full border-white/10 hover:bg-white/5"
              onClick={() => router.push('/interview')}
            >
              Back to Interview Setup
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const handleNext = () => {
    setValidationError('');
    setEvaluationError('');
    setIsSubmitting(false);
    setEvaluationStage('idle');

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestionId = String(questions[nextIndex]?.id);
      setCurrentIndex(nextIndex);
      setAnswer(savedAnswersByQuestion[nextQuestionId] || '');
      setAiStatus('LISTENING');
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || evaluationStage === 'saving') {
      return;
    }

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setValidationError('Please provide a response before submitting.');
      return;
    }

    setValidationError('');
    setEvaluationError('');
    setIsSubmitting(true);
    setEvaluationStage('saving');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const saveResult = await saveInterviewAnswer({
      interviewId: id as string,
      questionId: currentQuestionId,
      answerText: trimmedAnswer,
      apiUrl,
    });

    if (!saveResult.success) {
      setIsSubmitting(false);
      setEvaluationStage('save_error');
      setEvaluationError(saveResult.error || 'Failed to save your response to the server. Please try again.');
      return;
    }

    // Update locally saved answers cache
    const updatedAnswers = { ...savedAnswersByQuestion, [currentQuestionId]: trimmedAnswer };
    setSavedAnswersByQuestion(updatedAnswers);
    setEvaluationStage('saved');

    // If there are more questions, advance directly to the next question
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestionId = String(questions[nextIndex]?.id);
      setCurrentIndex(nextIndex);
      setAnswer(updatedAnswers[nextQuestionId] || '');
      setEvaluationStage('idle');
      setIsSubmitting(false);
      setAiStatus('LISTENING');
      return;
    }

    // On the final question, query backend to verify interview completion
    try {
      const statusRes = await fetch(`${apiUrl}/api/interviews/${id}`);
      if (statusRes.ok) {
        const interviewData = await statusRes.json();
        if (interviewData.status === 'COMPLETED') {
          setIsSubmitting(false);
          setIsInterviewComplete(true);
          setAiStatus('COMPLETED');
          loadEvaluationReport();
          return;
        }
      }
    } catch (err) {
      console.error('Error verifying interview completion lifecycle:', err);
    }

    // Check if any earlier questions remain unanswered
    const unansweredIndex = questions.findIndex(
      (q, idx) => idx !== currentIndex && !updatedAnswers[String(q.id)]?.trim()
    );

    if (unansweredIndex !== -1) {
      setCurrentIndex(unansweredIndex);
      setAnswer(updatedAnswers[String(questions[unansweredIndex]?.id)] || '');
      setEvaluationStage('idle');
      setIsSubmitting(false);
      setValidationError('Please complete all interview questions before submitting the final interview.');
      return;
    }

    // Transition to batch report evaluation
    setIsSubmitting(false);
    setIsInterviewComplete(true);
    setAiStatus('COMPLETED');
    loadEvaluationReport();
  };

  const handleCodeSubmit = async (code: string = '') => {
    const codeAnswer = code.trim();
    if (!codeAnswer) {
      setValidationError('Please write some code before submitting.');
      return;
    }

    setValidationError('');
    setEvaluationError('');
    setIsSubmitting(true);
    setEvaluationStage('saving');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const saveResult = await saveInterviewAnswer({
      interviewId: id as string,
      questionId: currentQuestionId,
      answerText: codeAnswer,
      apiUrl,
    });

    if (!saveResult.success) {
      setIsSubmitting(false);
      setEvaluationStage('save_error');
      setEvaluationError(saveResult.error || 'Failed to save code response.');
      return;
    }

    const updatedAnswers = { ...savedAnswersByQuestion, [currentQuestionId]: codeAnswer };
    setSavedAnswersByQuestion(updatedAnswers);
    setEvaluationStage('saved');

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestionId = String(questions[nextIndex]?.id);
      setCurrentIndex(nextIndex);
      setAnswer(updatedAnswers[nextQuestionId] || '');
      setEvaluationStage('idle');
      setIsSubmitting(false);
      setAiStatus('LISTENING');
      return;
    }

    // On final question, verify backend completion before batch report
    try {
      const statusRes = await fetch(`${apiUrl}/api/interviews/${id}`);
      if (statusRes.ok) {
        const interviewData = await statusRes.json();
        if (interviewData.status === 'COMPLETED') {
          setIsSubmitting(false);
          setIsInterviewComplete(true);
          setAiStatus('COMPLETED');
          loadEvaluationReport();
          return;
        }
      }
    } catch (err) {
      console.error('Failed to verify interview completion:', err);
    }

    setIsSubmitting(false);
    setIsInterviewComplete(true);
    setAiStatus('COMPLETED');
    loadEvaluationReport();
  };

  const handleSkip = () => {
    setValidationError('');
    setEvaluationError('');
    setIsSubmitting(false);
    setEvaluationStage('idle');

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestionId = String(questions[nextIndex]?.id);
      setCurrentIndex(nextIndex);
      setAnswer(savedAnswersByQuestion[nextQuestionId] || '');
    } else {
      const unansweredIndex = questions.findIndex(
        (q) => !savedAnswersByQuestion[String(q.id)]?.trim()
      );
      if (unansweredIndex !== -1) {
        setCurrentIndex(unansweredIndex);
        setAnswer(savedAnswersByQuestion[String(questions[unansweredIndex]?.id)] || '');
        setValidationError('All interview questions must be answered to complete the interview and generate your report.');
      }
    }
  };


  // Keyboard shortcut listener for Ctrl + Enter / Cmd + Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isSubmitting && evaluationStage !== 'saving' && evaluationStage !== 'evaluating') {
        handleSubmit();
      }
    }
  };

  // Live text metrics
  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const charCount = answer.length;

  // Secondary AI Companion Panel
  const renderAIPanel = () => {
    let aiVisuals = '';
    let aiText = '';

    if (evaluationStage === 'saving') {
      aiVisuals = 'border-brand-500/50 animate-[pulse_0.8s_ease-in-out_infinite] bg-brand-900/20 shadow-[0_0_15px_rgba(139,92,246,0.3)] text-brand-300';
      aiText = 'Saving response to server...';
    } else if (evaluationStage === 'saved') {
      aiVisuals = 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300';
      aiText = 'Answer saved securely.';
    } else if (isGeneratingReport) {
      aiVisuals = 'border-cyan-500/50 animate-[pulse_0.5s_ease-in-out_infinite] bg-cyan-900/20 shadow-[0_0_15px_rgba(6,182,212,0.3)] text-cyan-300';
      aiText = 'AI evaluating all responses...';
    } else if (isInterviewComplete) {
      aiVisuals = 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300';
      aiText = 'Evaluation report ready.';
    } else if (evaluationStage === 'save_error') {
      aiVisuals = 'border-rose-500/40 bg-rose-950/20 text-rose-300';
      aiText = 'Failed to save response.';
    } else if (aiStatus === 'LISTENING') {
      aiVisuals = 'border-brand-500/30 animate-pulse bg-brand-900/10 text-brand-300';
      aiText = 'Listening to your thoughts...';
    } else {
      aiVisuals = 'border-white/10 bg-white/5 text-slate-500';
      aiText = 'Session Completed';
    }

    return (
      <div className="relative rounded-2xl overflow-hidden glass-card p-4 border border-white/10 flex flex-col transition-all duration-500">
        <div className={`absolute inset-0 z-0 transition-colors duration-500 ${
          isGeneratingReport || evaluationStage === 'saving'
            ? 'bg-gradient-to-br from-brand-900/30 to-cyan-900/30'
            : isInterviewComplete || evaluationStage === 'saved'
            ? 'bg-gradient-to-br from-emerald-950/20 to-obsidian'
            : 'bg-gradient-to-br from-brand-900/10 to-obsidian'
        }`} />

        <div className="relative z-10 flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-full border flex items-center justify-center relative shrink-0 transition-all duration-500 ${aiVisuals}`}>
            {(isGeneratingReport || evaluationStage === 'saving') && (
              <>
                <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-[spin_1s_linear_infinite]" />
                <div className="absolute inset-1 rounded-full border-b-2 border-brand-400 animate-[spin_1.5s_linear_infinite_reverse]" />
              </>
            )}
            {aiStatus === 'LISTENING' && evaluationStage === 'idle' && (
              <div className="absolute inset-0 rounded-full border border-brand-500/40 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
            )}
            <BrainCircuit className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">AI Companion</span>
              <span className={`inline-block w-2 h-2 rounded-full ${
                isGeneratingReport || evaluationStage === 'saving'
                  ? 'bg-cyan-400 animate-ping'
                  : isInterviewComplete || evaluationStage === 'saved'
                  ? 'bg-emerald-400'
                  : evaluationStage === 'save_error'
                  ? 'bg-rose-400'
                  : 'bg-brand-400'
              }`} />
            </div>
            <p className={`text-xs sm:text-sm font-medium mt-0.5 truncate ${
              isGeneratingReport
                ? 'text-cyan-300'
                : isInterviewComplete || evaluationStage === 'saved'
                ? 'text-emerald-300'
                : evaluationStage === 'save_error'
                ? 'text-rose-300'
                : 'text-slate-300'
            }`}>
              {aiText}
            </p>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-obsidian text-foreground selection:bg-brand-500/30 flex flex-col">
      <Navbar mode="session" />
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="absolute inset-0 bg-glow-gradient opacity-20 pointer-events-none" />

      {/* Full-Viewport Main Session Shell */}
      <div className="relative z-10 flex-1 flex flex-col pt-18 pb-3 px-3 sm:px-6 max-w-[1800px] w-full mx-auto min-h-0 h-screen lg:overflow-hidden overflow-y-auto">

        {/* Top Session Navigation & Context Bar */}
        <div className="h-12 flex items-center justify-between border-b border-white/10 pb-2 mb-2 shrink-0">
          {/* Left: Question Progress, Difficulty & Focus */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold">
              <span>Question {currentIndex + 1}</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">{questions.length}</span>
            </div>

            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getDifficultyBadge(interviewDifficulty)}`}>
              {interviewDifficulty}
            </span>

            {focusArea && (
              <span className="hidden md:inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 text-slate-400 border border-white/10">
                {focusArea}
              </span>
            )}
          </div>

          {/* Center: Mode Switcher (only for CODING questions) or Question Format Badge */}
          <div className="flex items-center gap-2">
            {isCodingQuestion ? (
              <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setMode('text')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    mode === 'text'
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" /> Text Mode
                </button>
                <button
                  type="button"
                  onClick={() => setMode('code')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    mode === 'code'
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" /> Coding IDE
                </button>
              </div>
            ) : (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 font-medium">
                <span>Format:</span>
                <span className="text-white capitalize font-semibold">
                  {currentQuestionType === 'SYSTEM_DESIGN' ? 'System Design' : 'Theory / Conceptual'}
                </span>
              </div>
            )}
          </div>

          {/* Right: Timer & Secondary AI Status Pill */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-brand-400" />
              <span>{formatTime(timerSeconds)}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300">
              <BrainCircuit className={`w-3.5 h-3.5 ${aiStatus === 'EVALUATING' ? 'text-cyan-400 animate-spin' : 'text-brand-400'}`} />
              <span className="hidden md:inline">{aiStatus === 'LISTENING' ? 'AI: Listening' : aiStatus === 'EVALUATING' ? 'AI: Analyzing...' : 'Completed'}</span>
            </div>
          </div>
        </div>

        {/* Content View: Consolidated Evaluation Report OR Coding Workspace OR Full-Viewport Theory Workspace */}
        {isInterviewComplete ? (
          <EvaluationReportView
            report={evaluationReport}
            isLoading={isGeneratingReport}
            error={reportError}
            onRetry={loadEvaluationReport}
            onReturnToSetup={() => router.push('/interview')}
          />
        ) : isCodingQuestion && mode === 'code' ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodingWorkspace
              question={currentQuestion}
              interviewDifficulty={interviewDifficulty}
              interviewFocusArea={focusArea}
              onSubmit={handleCodeSubmit}
              isSubmitting={isSubmitting}
              questionNumber={currentIndex + 1}
              totalQuestions={questions.length}
            />
          </div>
        ) : (
          /* ======================================================== */
          /* FULL-VIEWPORT PROFESSIONAL THEORY INTERVIEW UI          */
          /* ======================================================== */
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3.5 overflow-hidden">

            {/* ---------------------------------------------------- */}
            {/* Left Column: 70% Primary Q&A Workspace               */}
            {/* ---------------------------------------------------- */}
            <div className="w-full lg:w-[70%] flex flex-col min-h-0 overflow-hidden gap-3">

              {/* Question Header Card (Compact & Clear) */}
              <Card className="glass-card-strong border-white/10 p-5 shrink-0 overflow-hidden relative">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold uppercase tracking-wider">
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getDifficultyBadge(interviewDifficulty)}`}>
                      {interviewDifficulty}
                    </span>
                    {focusArea && (
                      <span className="text-xs text-slate-400 font-medium bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                        {focusArea}
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                    IntervAI Technical Evaluation
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white leading-snug tracking-tight break-words">
                  {currentQuestion?.questionText}
                </h2>
              </Card>

              {/* Answer Editor Card (Primary Focus, Flexes Vertically) */}
              <Card className="glass-card border-white/10 flex-1 min-h-0 flex flex-col p-5 overflow-hidden gap-3">
                {/* Header Row with labels, live metrics, and keyboard hint */}
                <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <FileQuestion className="w-4 h-4 text-brand-400" />
                    <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                      Candidate Response
                    </label>
                    {evaluationStage === 'saved' ? (
                      <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Response saved
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5 hidden sm:inline">
                        In-session response
                      </span>
                    )}
                  </div>

                  {/* Counters & Keyboard Shortcut */}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <div className="font-mono">
                      <span className="text-slate-200 font-semibold">{wordCount}</span> {wordCount === 1 ? 'word' : 'words'} · <span className="text-slate-200 font-semibold">{charCount}</span> chars
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 text-slate-500 border-l border-white/10 pl-3">
                      <CornerDownLeft className="w-3 h-3 text-slate-500" />
                      <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-200 font-mono text-[11px] border border-white/10">Ctrl / ⌘ + Enter</kbd> to submit</span>
                    </div>
                  </div>
                </div>

                {/* Flexible Response Textarea */}
                <div className="flex-1 min-h-0 relative flex flex-col">
                  <textarea
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      if (validationError) setValidationError('');
                      if (evaluationStage === 'save_error') setEvaluationStage('idle');
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting || evaluationStage === 'saving'}
                    placeholder={`Structure your response with clear reasoning:
1. Core Concept & Key Definition
2. Technical Mechanism & Architectural Considerations
3. Trade-offs, Edge Cases, or Real-world Examples...`}
                    className="w-full h-full min-h-[220px] lg:min-h-0 flex-1 bg-black/40 border border-white/10 rounded-xl p-4 sm:p-5 text-base text-slate-100 placeholder:text-slate-500 leading-relaxed font-sans focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/40 resize-none overflow-y-auto transition-all disabled:opacity-60"
                  />
                </div>

                {/* Validation Error Banner */}
                <AnimatePresence>
                  {validationError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-lg p-3 flex items-center gap-2 shrink-0"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{validationError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Answer Save Error Banner */}
                <AnimatePresence>
                  {evaluationStage === 'save_error' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-lg p-3 flex items-center justify-between gap-2 shrink-0"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{evaluationError || 'Unable to save your response. Please try again.'}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="h-7 px-3 text-xs border-rose-500/30 hover:bg-rose-500/20 text-rose-200 shrink-0 font-medium"
                      >
                        Try Again
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Accessible Action Row */}
                <div className="flex items-center justify-between gap-3 pt-2 shrink-0 border-t border-white/5">
                  <Button
                    variant="outline"
                    className="border-white/10 hover:bg-white/5 text-slate-300 h-10 px-5 text-xs font-medium"
                    onClick={handleSkip}
                    disabled={isSubmitting || evaluationStage === 'saving'}
                  >
                    Skip Question
                    <SkipForward className="w-3.5 h-3.5 ml-2" />
                  </Button>

                  <Button
                    variant="glow"
                    className="h-10 px-7 text-xs font-semibold relative overflow-hidden"
                    onClick={handleSubmit}
                    disabled={isSubmitting || evaluationStage === 'saving'}
                  >
                    {evaluationStage === 'saving' ? (
                      <>
                        <RefreshCcw className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Saving Response...
                      </>
                    ) : isFinalQuestion ? (
                      <>
                        Submit & Complete Interview
                        <CheckCircle2 className="w-3.5 h-3.5 ml-2 text-cyan-300" />
                      </>
                    ) : (
                      <>
                        Submit Response
                        <Send className="w-3.5 h-3.5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </div>


            {/* ---------------------------------------------------- */}
            {/* Right Column: 30% Compact Sidebar                    */}
            {/* ---------------------------------------------------- */}
            <div className="w-full lg:w-[30%] flex flex-col gap-3 min-h-0 overflow-y-auto shrink-0">

              {/* AI Companion Card */}
              {renderAIPanel()}

              {/* Progress Card */}
              <Card className="glass-card-strong p-5 border-white/10 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Session Progress</span>
                  <span className="text-white font-semibold font-mono">
                    {currentIndex + 1} / {questions.length} ({Math.round(((currentIndex + 1) / questions.length) * 100)}%)
                  </span>
                </div>

                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-brand-500 to-cyan-500 h-full transition-all duration-500 ease-out"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-white/5 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-brand-400" /> Session Timer
                  </span>
                  <span className="text-white font-mono text-sm font-semibold">{formatTime(timerSeconds)}</span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-white/5">
                  <span>Interview Type</span>
                  <span className="text-slate-200 capitalize font-medium">{interviewType?.toLowerCase() || 'Technical'}</span>
                </div>
              </Card>

              {/* Quick Structured Reasoning Guidance Card */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-1.5 text-brand-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Structured Reasoning Tips</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc list-inside leading-relaxed">
                  <li>State the core principle and definition upfront.</li>
                  <li>Walk through architecture, tradeoffs, and execution flow.</li>
                  <li>Address edge cases, scalability, or real-world systems.</li>
                </ul>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default function InterviewSession() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-obsidian text-foreground flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    }>
      <InterviewSessionContent />
    </Suspense>
  );
}
