'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useAuth } from '@/components/auth/AuthProvider';
import { questionOriginLabel, researchNote } from '@/lib/adaptive-setup';
import { CODING_UNAVAILABLE_NOTE, workspaceFor } from '@/lib/workspace-mode';
import { sessionCompanion } from '@/lib/companion-status';
import { VoiceAnswer } from '@/components/interview/VoiceAnswer';
import { LazyCompactCoach } from '@/components/marketing/coach/LazyCoach';
import { QuestionSource, SourcesDisclosure } from '@/components/interview/SourcesDisclosure';
import {
  answerTextFor,
  countAnswered,
  browserStorage,
  chooseResumeIndex,
  createSnapshotStore,
  fetchInterviewProgress,
  InterviewProgress,
  resumeStorageKey,
  savedAnswersFromProgress,
  SnapshotStore,
} from '@/lib/interview-resume';
import {
  clockOffsetMs,
  finalizeInterview,
  formatRemaining,
  InterviewTiming,
  parseTiming,
  remainingMs,
  startInterviewClock,
  timeWarning,
} from '@/lib/interview-timer';
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
import { SubmitCodeResponse } from '@/lib/coding-api';



interface QuestionItem {
  id: string | number;
  questionText: string;
  type?: 'THEORY' | 'CODING' | 'SYSTEM_DESIGN';
  /** Runnable coding problem for CODING questions (null when there is none). */
  codingProblemSlug?: string | null;
  /** Planned as coding but not runnable, so it is answered in text. */
  codingUnavailable?: boolean;
  /** Where the question came from (curated bank, resume, follow-up) and its role in the plan. */
  origin?: string | null;
  category?: string | null;
  /** Stored web sources that informed this question (only when research supported it). */
  sources?: QuestionSource[] | null;
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
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Resume support: server progress plus a per-user, per-interview local snapshot
  // (current question and unsent drafts). See lib/interview-resume.ts.
  const [progress, setProgress] = useState<InterviewProgress | null>(null);
  const [resumeStore, setResumeStore] = useState<SnapshotStore | null>(null);

  // Interview time limit. The deadline comes from the server; this clock only displays it.
  const [timing, setTiming] = useState<InterviewTiming | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [timeUp, setTimeUp] = useState(false);
  const [timeUpNotice, setTimeUpNotice] = useState('');
  // Whether this interview's plan used web research (summary only; sources live on each question).
  const [research, setResearch] = useState<{ status: string; sourceCount: number } | null>(null);
  const timeUpHandled = useRef(false);

  // Config State
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(!id);
  const [error, setError] = useState(!id);
  const [errorMessage, setErrorMessage] = useState(!id ? 'No interview ID provided in URL.' : '');
  const [interviewType, setInterviewType] = useState<string>('');
  const [interviewDifficulty, setInterviewDifficulty] = useState<string>('MEDIUM');
  const [focusArea, setFocusArea] = useState<string>('');

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
    } catch (err: unknown) {
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
        const [questionsRes, interviewRes, progressResult] = await Promise.all([
          apiFetch(`${apiUrl}/api/interviews/${id}/questions`),
          apiFetch(`${apiUrl}/api/interviews/${id}`),
          fetchInterviewProgress(id, { apiUrl }),
        ]);

        if (!questionsRes.ok || !interviewRes.ok) {
          setError(true);
          setErrorMessage(
            questionsRes.status === 401 || interviewRes.status === 401
              ? 'Your session has expired. Please log in again.'
              : questionsRes.status === 404 || interviewRes.status === 404
              ? 'Interview not found.'
              : 'Failed to load session data.'
          );
          setIsLoaded(true);
          return;
        }

        const data = await questionsRes.json();
        const interviewData = await interviewRes.json();
        const loadedQuestions: QuestionItem[] = data.questions || [];

        setQuestions(loadedQuestions);
        setInterviewType(interviewData.type || '');
        setInterviewDifficulty(interviewData.difficulty || 'MEDIUM');
        setFocusArea(interviewData.focusArea || '');
        setResearch(interviewData.research ?? null);

        const store = userId ? createSnapshotStore(browserStorage(), resumeStorageKey(userId, id)) : null;
        setResumeStore(store);

        // If interview was already completed, automatically restore or display the final report
        if (interviewData.status === 'COMPLETED') {
          store?.clear();
          if (interviewData.completionReason === 'TIME_EXPIRED') {
            setTimeUp(true);
            setTimeUpNotice('The time limit for this interview ended. Only answers submitted before the deadline are evaluated.');
          }
          setIsInterviewComplete(true);
          loadEvaluationReport();
          return;
        }

        // Without saved progress we cannot tell what was already answered; stop
        // rather than risk the candidate re-answering over saved work.
        if (!progressResult.ok) {
          setError(true);
          setErrorMessage(
            progressResult.status === 401
              ? 'Your session has expired. Please log in again.'
              : 'We couldn’t load your saved progress. Please try again; your submitted answers are safe.'
          );
          return;
        }

        // Resume where the candidate left off.
        const saved = savedAnswersFromProgress(progressResult.progress);
        const snapshot = store?.get();
        setProgress(progressResult.progress);
        setSavedAnswersByQuestion(saved);
        if (snapshot && loadedQuestions.length > 0) {
          const startIndex = chooseResumeIndex(loadedQuestions, progressResult.progress, snapshot);
          setCurrentIndex(startIndex);
          setAnswer(answerTextFor(String(loadedQuestions[startIndex].id), progressResult.progress, snapshot, saved));
        } else if (loadedQuestions.length > 0) {
          setAnswer(saved[String(loadedQuestions[0].id)] ?? '');
        }

        // Start the interview clock (idempotent: a refresh or resume keeps the original deadline).
        const requestedAt = Date.now();
        const startedTiming =
          (await startInterviewClock(id, { apiUrl })) ?? parseTiming(progressResult.progress.timing ?? interviewData.timing);
        if (startedTiming) {
          setTiming(startedTiming);
          setClockOffset(clockOffsetMs(startedTiming, requestedAt));
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
    // userId is stable once RequireAuth has rendered this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);

  // Remember the current question so a refresh or return visit reopens it.
  const resumeQuestionId = questions[currentIndex] ? String(questions[currentIndex].id) : '';
  useEffect(() => {
    if (!resumeStore || !resumeQuestionId || isInterviewComplete) return;
    resumeStore.update((snap) => ({ ...snap, currentQuestionId: resumeQuestionId }));
  }, [resumeStore, resumeQuestionId, isInterviewComplete]);

  // Write pending drafts immediately when the tab is hidden or closed.
  useEffect(() => {
    if (!resumeStore) return;
    const flush = () => resumeStore.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [resumeStore]);

  // A finished interview has nothing left to resume.
  useEffect(() => {
    if (isInterviewComplete) resumeStore?.clear();
  }, [isInterviewComplete, resumeStore]);

  // Tick once a second while a timed interview is running.
  const hasDeadline = Boolean(timing?.deadlineAt);
  useEffect(() => {
    if (!hasDeadline || isInterviewComplete) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasDeadline, isInterviewComplete]);

  const remaining = remainingMs(timing, clockOffset, nowMs);
  const warning = timeWarning(remaining);

  /**
   * Time is up: stop taking answers, let the server close the interview
   * (exactly once), then build the report from what was submitted.
   * Unsent text is reported honestly as not submitted.
   */
  const handleTimeUp = async () => {
    if (timeUpHandled.current || !id) return;
    timeUpHandled.current = true;
    setTimeUp(true);
    setIsSubmitting(false);

    const snapshot = resumeStore?.get();
    const unsent = new Set(
      Object.entries(snapshot?.answerDrafts ?? {})
        .filter(([qid, draft]) => draft.text.trim() && (draft.text.trim() !== (savedAnswersByQuestion[qid] ?? '').trim()))
        .map(([qid]) => qid)
    );
    // resumeQuestionId is the current question's id (declared above this handler).
    if (resumeQuestionId && answer.trim() && answer.trim() !== (savedAnswersByQuestion[resumeQuestionId] ?? '').trim()) {
      unsent.add(resumeQuestionId);
    }
    setTimeUpNotice(
      unsent.size > 0
        ? `Time's up. Answers you submitted before the deadline are being evaluated. Unsent text on ${unsent.size} question${unsent.size === 1 ? '' : 's'} was not submitted and is not part of the report.`
        : "Time's up. Answers you submitted before the deadline are being evaluated."
    );

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    // The server's clock decides; if it says a moment remains, wait and ask again.
    for (let attempt = 0; attempt < 5; attempt++) {
      const outcome = await finalizeInterview(id, { apiUrl });
      if (outcome.result === 'finalized') break;
      await new Promise((r) => setTimeout(r, 1500));
    }

    setIsInterviewComplete(true);
    loadEvaluationReport();
  };

  useEffect(() => {
    if (warning === 'expired' && !isInterviewComplete) void handleTimeUp();
    // handleTimeUp reads current state; it runs at most once (guarded by a ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warning, isInterviewComplete]);

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
  // The workspace follows the current question's type (never a previous question's mode).
  const workspace = workspaceFor(currentQuestion);
  const isCodingQuestion = workspace.mode === 'code';
  const lockViewport = isCodingQuestion || isInterviewComplete;
  const isFinalQuestion = questions.length > 0 && currentIndex === questions.length - 1;
  const answeredCount = progress ? countAnswered(questions, progress) : 0;

  /** Text to show for a question: a newer unsent draft, otherwise the saved answer. */
  const textFor = (questionId: string, saved: Record<string, string>) =>
    resumeStore ? answerTextFor(questionId, progress, resumeStore.get(), saved) : saved[questionId] || '';

  /** Saves the unsent answer for the current question (debounced to storage). */
  const recordAnswerDraft = (text: string) => {
    if (!resumeStore || !currentQuestionId) return;
    resumeStore.update((snap) => ({
      ...snap,
      answerDrafts: { ...snap.answerDrafts, [currentQuestionId]: { text, updatedAt: Date.now() } },
    }));
  };

  /** After the server accepts an answer, the local draft must not shadow it later. */
  const markAnswerSubmitted = (questionId: string, answerText: string) => {
    resumeStore?.update((snap) => {
      const rest = { ...snap.answerDrafts };
      delete rest[questionId];
      return { ...snap, answerDrafts: rest };
    });
    setProgress((prev) =>
      prev
        ? {
            ...prev,
            answers: [
              ...prev.answers.filter((a) => a.questionId !== questionId),
              { questionId, answerText, submittedAt: new Date().toISOString() },
            ],
          }
        : prev
    );
  };



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
          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="glow"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
            <Button
              variant="outline"
              className="w-full border-white/10 hover:bg-white/5"
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
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
      setAnswer(textFor(nextQuestionId, savedAnswersByQuestion));
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
      if (saveResult.expired) {
        void handleTimeUp();
        return;
      }
      setEvaluationStage('save_error');
      setEvaluationError(saveResult.error || 'Failed to save your response to the server. Please try again.');
      return;
    }

    // Update locally saved answers cache
    markAnswerSubmitted(currentQuestionId, trimmedAnswer);
    const updatedAnswers = { ...savedAnswersByQuestion, [currentQuestionId]: trimmedAnswer };
    setSavedAnswersByQuestion(updatedAnswers);
    setEvaluationStage('saved');

    // If there are more questions, advance directly to the next question
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestionId = String(questions[nextIndex]?.id);
      setCurrentIndex(nextIndex);
      setAnswer(textFor(nextQuestionId, updatedAnswers));
      setEvaluationStage('idle');
      setIsSubmitting(false);
      return;
    }

    // On the final question, query backend to verify interview completion
    try {
      const statusRes = await apiFetch(`${apiUrl}/api/interviews/${id}`);
      if (statusRes.ok) {
        const interviewData = await statusRes.json();
        if (interviewData.status === 'COMPLETED') {
          setIsSubmitting(false);
          setIsInterviewComplete(true);
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
      setAnswer(textFor(String(questions[unansweredIndex]?.id), updatedAnswers));
      setEvaluationStage('idle');
      setIsSubmitting(false);
      setValidationError('Please complete all interview questions before submitting the final interview.');
      return;
    }

    // Transition to batch report evaluation
    setIsSubmitting(false);
    setIsInterviewComplete(true);
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
      if (saveResult.expired) {
        void handleTimeUp();
        return;
      }
      setEvaluationStage('save_error');
      setEvaluationError(saveResult.error || 'Failed to save code response.');
      return;
    }

    markAnswerSubmitted(currentQuestionId, codeAnswer);
    const updatedAnswers = { ...savedAnswersByQuestion, [currentQuestionId]: codeAnswer };
    setSavedAnswersByQuestion(updatedAnswers);
    setEvaluationStage('saved');

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestionId = String(questions[nextIndex]?.id);
      setCurrentIndex(nextIndex);
      setAnswer(textFor(nextQuestionId, updatedAnswers));
      setEvaluationStage('idle');
      setIsSubmitting(false);
      return;
    }

    // On final question, verify backend completion before batch report
    try {
      const statusRes = await apiFetch(`${apiUrl}/api/interviews/${id}`);
      if (statusRes.ok) {
        const interviewData = await statusRes.json();
        if (interviewData.status === 'COMPLETED') {
          setIsSubmitting(false);
          setIsInterviewComplete(true);
          loadEvaluationReport();
          return;
        }
      }
    } catch (err) {
      console.error('Failed to verify interview completion:', err);
    }

    setIsSubmitting(false);
    setIsInterviewComplete(true);
    loadEvaluationReport();
  };

  const handleCodingSubmissionSuccess = async (submission: SubmitCodeResponse) => {
    setProgress((prev) =>
      prev
        ? {
            ...prev,
            codeSubmissions: [
              ...prev.codeSubmissions.filter((c) => c.questionId !== currentQuestionId),
              {
                questionId: currentQuestionId,
                language: submission.language,
                sourceCode: submission.sourceCode,
                status: submission.status,
                testsPassed: submission.testsPassed,
                totalTests: submission.totalTests,
                submittedAt: new Date().toISOString(),
              },
            ],
          }
        : prev
    );
    const updatedAnswers = { ...savedAnswersByQuestion, [currentQuestionId]: submission.sourceCode };
    setSavedAnswersByQuestion(updatedAnswers);
    setEvaluationStage('saved');

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestionId = String(questions[nextIndex]?.id);
      setCurrentIndex(nextIndex);
      setAnswer(textFor(nextQuestionId, updatedAnswers));
      setEvaluationStage('idle');
      setIsSubmitting(false);
      return;
    }

    const unansweredIndex = questions.findIndex(
      (q, idx) => idx !== currentIndex && !updatedAnswers[String(q.id)]?.trim()
    );

    if (unansweredIndex !== -1) {
      setCurrentIndex(unansweredIndex);
      setAnswer(textFor(String(questions[unansweredIndex]?.id), updatedAnswers));
      setEvaluationStage('idle');
      setIsSubmitting(false);
      setValidationError('Please complete all interview questions before viewing the final report.');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    try {
      const statusRes = await apiFetch(`${apiUrl}/api/interviews/${id}`);
      if (statusRes.ok) {
        const interviewData = await statusRes.json();
        if (interviewData.status === 'COMPLETED') {
          setIsSubmitting(false);
          setIsInterviewComplete(true);
          loadEvaluationReport();
          return;
        }
      }
    } catch (err) {
      console.error('Failed to verify interview completion:', err);
    }

    setIsSubmitting(false);
    setIsInterviewComplete(true);
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
      setAnswer(textFor(nextQuestionId, savedAnswersByQuestion));
    } else {
      const unansweredIndex = questions.findIndex(
        (q) => !savedAnswersByQuestion[String(q.id)]?.trim()
      );
      if (unansweredIndex !== -1) {
        setCurrentIndex(unansweredIndex);
        setAnswer(textFor(String(questions[unansweredIndex]?.id), savedAnswersByQuestion));
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

  // AI companion: mood and text come from real request state, never from timers.
  const companion = sessionCompanion({ evaluationStage, isGeneratingReport, isInterviewComplete, timeUp });
  const companionText = {
    ready: 'text-slate-300',
    busy: 'text-cyan-300',
    success: 'text-emerald-300',
    error: 'text-rose-300',
    done: 'text-emerald-300',
  }[companion.tone];
  const companionDot = {
    ready: 'bg-brand-400',
    busy: 'bg-cyan-400 animate-pulse',
    success: 'bg-emerald-400',
    error: 'bg-rose-400',
    done: 'bg-emerald-400',
  }[companion.tone];

  // Secondary AI Companion Panel (stays mounted across questions, so the 3D scene is not rebuilt)
  const renderAIPanel = () => (
    <div className="relative rounded-2xl overflow-hidden glass-card p-3 sm:p-4 border border-white/10 flex items-center gap-3 sm:gap-4">
      <div
        className={`absolute inset-0 z-0 transition-colors duration-500 ${
          companion.tone === 'busy'
            ? 'bg-gradient-to-br from-brand-900/30 to-cyan-900/30'
            : companion.tone === 'success' || companion.tone === 'done'
            ? 'bg-gradient-to-br from-emerald-950/20 to-obsidian'
            : 'bg-gradient-to-br from-brand-900/10 to-obsidian'
        }`}
      />
      <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 shrink-0 rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
        <LazyCompactCoach variant="compact" mood={companion.mood} className="h-full" />
      </div>
      <div className="relative z-10 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">AI Companion</span>
          <span className={`inline-block w-2 h-2 rounded-full ${companionDot}`} aria-hidden="true" />
        </div>
        <p role="status" aria-live="polite" className={`text-xs sm:text-sm font-medium mt-0.5 ${companionText}`} data-testid="companion-status">
          {companion.label}
        </p>
      </div>
    </div>
  );


  return (
    <div
      className={`min-h-screen bg-obsidian text-foreground selection:bg-brand-500/30 flex flex-col ${
        // The coding workspace and the report manage their own panes, so they keep the
        // viewport-locked layout. Theory questions lock only on wide screens; narrower
        // screens use normal page flow so the editor and actions are never squeezed.
        lockViewport ? 'h-screen max-h-screen overflow-hidden' : 'lg:h-screen lg:max-h-screen lg:overflow-hidden'
      }`}
    >
      <Navbar mode="session" />
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="absolute inset-0 bg-glow-gradient opacity-20 pointer-events-none" />

      {/* Full-Viewport Main Session Shell */}
      <div className={`relative z-10 flex-1 flex flex-col pt-18 pb-3 px-3 sm:px-6 max-w-[1800px] w-full mx-auto min-w-0 ${lockViewport ? 'min-h-0 h-full overflow-hidden' : 'lg:min-h-0 lg:h-full lg:overflow-hidden'}`}>

        {/* Top Session Navigation & Context Bar */}
        <div className="min-h-12 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2 shrink-0">
          {/* Left: Question Progress, Difficulty & Focus */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
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

          {/* Center: the question's format (the workspace below follows it automatically) */}
          <div className="flex items-center gap-2">
            <div
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 font-medium"
              data-testid="question-format"
            >
              {isCodingQuestion ? <Code2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Type className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>Format:</span>
              <span className="text-white font-semibold">{workspace.format}</span>
            </div>
          </div>

          {/* Right: Timer & Secondary AI Status Pill */}
          <div className="flex items-center gap-2 sm:gap-3">
            {remaining !== null ? (
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono ${
                  warning === 'one-minute' || warning === 'expired'
                    ? 'bg-rose-500/10 border-rose-400/30 text-rose-200'
                    : warning === 'five-minutes'
                    ? 'bg-amber-500/10 border-amber-400/30 text-amber-200'
                    : 'bg-white/5 border-white/10 text-slate-300'
                }`}
                title="Time remaining in this interview"
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="sr-only">Time remaining: </span>
                <span data-testid="time-remaining">{formatRemaining(remaining)}</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 font-mono">
                <Clock className="w-3.5 h-3.5 text-brand-400" />
                <span>{formatTime(timerSeconds)}</span>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300">
              <BrainCircuit className={`w-3.5 h-3.5 ${companion.tone === 'busy' ? 'text-cyan-400 animate-pulse' : 'text-brand-400'}`} aria-hidden="true" />
              <span className="hidden md:inline">AI: {companion.short}</span>
            </div>
          </div>
        </div>

        {/* Time-limit warnings (announced politely to screen readers) */}
        <div aria-live="polite" className="contents">
          {!isInterviewComplete && (warning === 'five-minutes' || warning === 'one-minute') && (
            <div
              role="status"
              className={`mb-3 rounded-lg border px-4 py-2 text-sm ${
                warning === 'one-minute' ? 'border-rose-400/30 bg-rose-500/10 text-rose-100' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
              }`}
            >
              {warning === 'one-minute'
                ? 'Less than 1 minute left. Submit your current answer now; unsent text is not evaluated.'
                : 'About 5 minutes left. Only submitted answers count toward your report.'}
            </div>
          )}
          {timeUp && timeUpNotice && (
            <div role="status" className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200">
              {timeUpNotice}
            </div>
          )}
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
        ) : isCodingQuestion ? (
          <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
            <CodingWorkspace
              interviewId={id as string}
              question={currentQuestion}
              interviewDifficulty={interviewDifficulty}
              interviewFocusArea={focusArea}
              onSubmitSuccess={handleCodingSubmissionSuccess}
              isSubmitting={isSubmitting}
              resumeStore={resumeStore}
              savedSubmission={progress?.codeSubmissions.find((c) => c.questionId === currentQuestionId)}
              questionNumber={currentIndex + 1}
              totalQuestions={questions.length}
            />
          </div>
        ) : (
          /* ======================================================== */
          /* FULL-VIEWPORT PROFESSIONAL THEORY INTERVIEW UI          */
          /* ======================================================== */
          <div className="flex-1 flex flex-col lg:flex-row gap-3.5 lg:min-h-0 lg:overflow-hidden" data-testid="theory-layout">

            {/* ---------------------------------------------------- */}
            {/* Left Column: 70% Primary Q&A Workspace               */}
            {/* ---------------------------------------------------- */}
            <div className="w-full lg:w-[70%] flex flex-col gap-3 min-w-0 lg:min-h-0 lg:overflow-hidden">

              {/* Question Header Card (Compact & Clear) */}
              <Card className="glass-card-strong border-white/10 p-4 sm:p-5 shrink-0 overflow-hidden relative">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold uppercase tracking-wider">
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getDifficultyBadge(interviewDifficulty)}`}>
                      {interviewDifficulty}
                    </span>
                    {questionOriginLabel(currentQuestion?.origin, currentQuestion?.category, Boolean(currentQuestion?.sources?.length)) && (
                      <span className="text-xs text-cyan-200 font-medium bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-400/20">
                        {questionOriginLabel(currentQuestion?.origin, currentQuestion?.category, Boolean(currentQuestion?.sources?.length))}
                      </span>
                    )}
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
                <SourcesDisclosure sources={currentQuestion?.sources} className="mt-3" />
                {workspace.codingUnavailable && (
                  <p role="note" className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                    {CODING_UNAVAILABLE_NOTE}
                  </p>
                )}
              </Card>

              {/* Answer Editor Card (Primary Focus, Flexes Vertically) */}
              <Card className="glass-card border-white/10 flex flex-col p-4 sm:p-5 gap-3 lg:flex-1 lg:min-h-0 lg:overflow-hidden" data-testid="answer-editor">
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

                {/* Optional voice answer: fills the editor for review; never submits */}
                <div className="shrink-0">
                  <VoiceAnswer
                    interviewId={id as string}
                    questionId={currentQuestionId}
                    text={answer}
                    onTextChange={(text) => {
                      setAnswer(text);
                      recordAnswerDraft(text);
                      if (validationError) setValidationError('');
                    }}
                    disabled={isSubmitting || evaluationStage === 'saving' || timeUp}
                  />
                </div>

                {/* Flexible Response Textarea */}
                <div className="flex flex-col lg:flex-1 lg:min-h-0">
                  <textarea
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      recordAnswerDraft(e.target.value);
                      if (validationError) setValidationError('');
                      if (evaluationStage === 'save_error') setEvaluationStage('idle');
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting || evaluationStage === 'saving'}
                    placeholder={`Structure your response with clear reasoning:
1. Core Concept & Key Definition
2. Technical Mechanism & Architectural Considerations
3. Trade-offs, Edge Cases, or Real-world Examples...`}
                    aria-label="Candidate response"
                    className="w-full min-h-[220px] sm:min-h-[260px] lg:min-h-0 lg:h-full lg:flex-1 bg-black/40 border border-white/10 rounded-xl p-4 sm:p-5 text-base text-slate-100 placeholder:text-slate-500 leading-relaxed font-sans focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/40 resize-none overflow-y-auto transition-all disabled:opacity-60"
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
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 pt-2 shrink-0 border-t border-white/5" data-testid="answer-actions">
                  <Button
                    variant="outline"
                    className="border-white/10 hover:bg-white/5 text-slate-300 h-10 px-5 text-xs font-medium w-full sm:w-auto"
                    onClick={handleSkip}
                    disabled={isSubmitting || evaluationStage === 'saving'}
                  >
                    Skip Question
                    <SkipForward className="w-3.5 h-3.5 ml-2" />
                  </Button>

                  <Button
                    variant="glow"
                    className="h-10 px-7 text-xs font-semibold relative overflow-hidden w-full sm:w-auto"
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
            <div className="w-full lg:w-[30%] flex flex-col gap-3 shrink-0 min-w-0 lg:min-h-0 lg:overflow-y-auto">

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
                  <span className="text-slate-400 font-medium">Answered</span>
                  <span className="text-white font-mono font-semibold" data-testid="answered-count">
                    {answeredCount} / {questions.length}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-white/5 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-brand-400" /> {remaining !== null ? 'Time Remaining' : 'Session Timer'}
                  </span>
                  <span className="text-white font-mono text-sm font-semibold">
                    {remaining !== null ? formatRemaining(remaining) : formatTime(timerSeconds)}
                  </span>
                </div>

                {researchNote(research) && (
                  <p className="text-[11px] leading-relaxed text-slate-400 pt-2 border-t border-white/5">{researchNote(research)}</p>
                )}

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
      <RequireAuth>
        <InterviewSessionContent />
      </RequireAuth>
    </Suspense>
  );
}
