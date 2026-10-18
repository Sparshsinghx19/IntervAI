'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  ChevronRight,
  BrainCircuit,
  Loader2,
  Layers,
  Gauge,
  Target,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Navbar } from '@/components/marketing/navbar';
import { API_URL, apiFetch } from '@/lib/api-client';
import { DEFAULT_DURATION_MINUTES, DURATION_OPTIONS } from '@/lib/interview-timer';
import {
  buildCreatePayload,
  InterviewMode,
  ResumeProfile,
  SetupQuestionType,
  validateSetup,
} from '@/lib/adaptive-setup';
import { ResumeInput } from './ResumeInput';
import { SelectorCard } from './SelectorCard';
import {
  interviewTypes,
  difficulties,
  focusAreas,
} from '@/data/interview-options';

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

interface ApiError extends Error {
  status?: number;
  serverMessage?: string;
}

export function InterviewSetup() {
  const router = useRouter();

  const [interviewType, setInterviewType] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [focusArea, setFocusArea] = useState<string>('');
  const [duration, setDuration] = useState<string>(String(DEFAULT_DURATION_MINUTES));
  const [mode, setMode] = useState<InterviewMode>('TOPIC');
  const [targetRole, setTargetRole] = useState('');
  const [resumeProfile, setResumeProfile] = useState<ResumeProfile | null>(null);
  const [questionTypes, setQuestionTypes] = useState<SetupQuestionType[]>(['THEORY']);

  const [isPreparing, setIsPreparing] = useState(false);
  // One id per setup: retries of the same request never create a second interview.
  const [requestId] = useState<string>(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
  const [error, setError] = useState('');

  const setup = {
    mode,
    interviewType,
    difficulty,
    focusArea,
    targetRole,
    durationMinutes: parseInt(duration, 10),
    questionTypes,
    resumeProfile,
  };
  const validationMessage = validateSetup(setup);
  const isValid = validationMessage === null;

  // Sections shown for the chosen mode, in order (used for step numbers and progress).
  const steps: Array<{ key: string; done: boolean }> = [
    { key: 'mode', done: true },
    ...(mode !== 'TOPIC' ? [{ key: 'resume', done: Boolean(resumeProfile) && targetRole.trim().length >= 2 }] : []),
    ...(mode !== 'RESUME' ? [{ key: 'type', done: Boolean(interviewType) }] : []),
    { key: 'difficulty', done: Boolean(difficulty) },
    ...(mode !== 'RESUME' ? [{ key: 'focus', done: Boolean(focusArea) }] : []),
    ...(mode !== 'TOPIC' ? [{ key: 'types', done: questionTypes.length > 0 }] : []),
    { key: 'time', done: true },
  ];
  const stepNo = (key: string) => String(steps.findIndex((st) => st.key === key) + 1).padStart(2, '0');
  const completedCount = steps.filter((st) => st.done).length;
  const totalSteps = steps.length;
  const plannedQuestionCount = { 15: 4, 30: 6, 45: 8, 60: 10 }[parseInt(duration, 10) as 15 | 30 | 45 | 60] ?? 6;

  const toggleQuestionType = (t: SetupQuestionType) =>
    setQuestionTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const selectedType = interviewTypes.find((t) => t.id === interviewType);
  const selectedDifficulty = difficulties.find((d) => d.id === difficulty);
  const selectedFocus = focusAreas.find((f) => f.id === focusArea);

  const handleStart = async () => {
    if (!isValid) {
      setError(validationMessage ?? 'Please complete the setup before starting.');
      return;
    }
    setError('');
    setIsPreparing(true);

    try {
      const res = await apiFetch(`${API_URL}/api/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCreatePayload(setup, requestId)),
      });

      if (!res.ok) {
        let serverMessage = '';
        try {
          const errorData = await res.json();
          if (errorData && typeof errorData.error === 'string') {
            serverMessage = errorData.error;
          } else if (errorData && typeof errorData.message === 'string') {
            serverMessage = errorData.message;
          }
        } catch {
          // Response body was not JSON or failed to parse
        }

        const safeDetail = serverMessage ? `: ${serverMessage}` : '';
        const httpError: ApiError = new Error(
          `Failed to create interview session (HTTP ${res.status}${safeDetail})`
        );
        httpError.status = res.status;
        httpError.serverMessage = serverMessage;
        throw httpError;
      }

      const data = await res.json();

      // Simulate brief preparation before navigation
      setTimeout(() => {
        router.push(`/interview/session?id=${data.id}`);
      }, 1500);
    } catch (err: unknown) {
      console.error(err);
      const apiErr = err as ApiError;
      if (apiErr?.status === 401) {
        setError('Your session has expired. Please log in again to start an interview.');
      } else if ((apiErr?.status === 400 || apiErr?.status === 503) && apiErr.serverMessage) {
        setError(apiErr.serverMessage);
      } else if (apiErr?.status) {
        const detail = apiErr.serverMessage ? ` (${apiErr.serverMessage})` : '';
        setError(
          `Unable to create interview [HTTP ${apiErr.status}]${detail}. Please try again.`
        );
      } else {
        setError(
          'Could not connect to the backend server. Please verify your network connection and server status.'
        );
      }
      setIsPreparing(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-foreground selection:bg-brand-500/30">
      <Navbar mode="app" />
      <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none" />
      <div className="absolute inset-0 bg-glow-gradient opacity-40 pointer-events-none" />

      {/* Main Content Container: Expanded to max-w-7xl matching the header alignment */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pt-24 pb-16 md:pt-28 md:pb-20">
        
        {/* Header Block */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 md:mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-medium mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Interactive Coach Setup</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-3">
            Configure your interview
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
            Select your interview format, difficulty, and target topics. Your AI coach will adapt question depth and evaluate responses in real time.
          </p>
        </motion.div>

        {/* Two-Column Responsive Layout: Left (Configuration) & Right (Overview/Summary) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-10 items-start">

          {/* ======================================================== */}
          {/* LEFT COLUMN: INTERVIEW CONFIGURATION (8 of 12 cols)     */}
          {/* ======================================================== */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="lg:col-span-8 space-y-7 md:space-y-8"
          >
            {/* Interview mode */}
            <motion.section variants={fadeUpVariant} className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-md bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold flex items-center justify-center">
                    {stepNo('mode')}
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                    Interview Mode
                  </h2>
                </div>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  What should the questions be based on?
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <SelectorCard id="TOPIC" label="Topic" description="Questions on a subject you choose" selected={mode === 'TOPIC'} onClick={(v) => setMode(v as InterviewMode)} />
                <SelectorCard id="RESUME" label="Resume" description="Questions about your own projects and skills" selected={mode === 'RESUME'} onClick={(v) => setMode(v as InterviewMode)} />
                <SelectorCard id="MIXED" label="Mixed (recommended)" description="Your resume plus a subject, in one interview" selected={mode === 'MIXED'} onClick={(v) => setMode(v as InterviewMode)} />
              </div>
            </motion.section>

            {/* Resume and target role */}
            {mode !== 'TOPIC' && (
              <motion.section variants={fadeUpVariant} initial="hidden" animate="visible" className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold flex items-center justify-center">
                      {stepNo('resume')}
                    </span>
                    <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                      Your Resume &amp; Target Role
                    </h2>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="target-role" className="block text-sm font-medium text-slate-200">Target role</label>
                  <input
                    id="target-role"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    maxLength={100}
                    placeholder="e.g. Backend Engineer"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  />
                </div>
                <ResumeInput profile={resumeProfile} onProfile={setResumeProfile} />
              </motion.section>
            )}

            {/* 1. Interview Type */}
            {mode !== 'RESUME' && (
            <motion.section variants={fadeUpVariant} className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-md bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold flex items-center justify-center">
                    {stepNo('type')}
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                    Interview Type
                  </h2>
                </div>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Select session format
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {interviewTypes.map((opt) => (
                  <SelectorCard
                    key={opt.id}
                    id={opt.id}
                    label={opt.label}
                    description={opt.description}
                    selected={interviewType === opt.id}
                    onClick={setInterviewType}
                  />
                ))}
              </div>
            </motion.section>

            )}

            {/* 2. Difficulty Level */}
            <motion.section variants={fadeUpVariant} className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-md bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold flex items-center justify-center">
                    {stepNo('difficulty')}
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                    Difficulty Level
                  </h2>
                </div>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Sets initial baseline
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {difficulties.map((opt) => (
                  <SelectorCard
                    key={opt.id}
                    id={opt.id}
                    label={opt.label}
                    description={opt.description}
                    selected={difficulty === opt.id}
                    onClick={setDifficulty}
                  />
                ))}
              </div>
            </motion.section>

            {/* 3. Focus Area */}
            {mode !== 'RESUME' && (
            <motion.section variants={fadeUpVariant} className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-md bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold flex items-center justify-center">
                    {stepNo('focus')}
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                    Focus Area
                  </h2>
                </div>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Target core domain
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {focusAreas.map((opt) => (
                  <SelectorCard
                    key={opt.id}
                    id={opt.id}
                    label={opt.label}
                    selected={focusArea === opt.id}
                    onClick={setFocusArea}
                  />
                ))}
              </div>
            </motion.section>


            )}

            {/* Question types (resume and mixed interviews) */}
            {mode !== 'TOPIC' && (
              <motion.section variants={fadeUpVariant} initial="hidden" animate="visible" className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold flex items-center justify-center">
                      {stepNo('types')}
                    </span>
                    <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                      Question Types
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Choose one or more
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5" role="group" aria-label="Question types">
                  <SelectorCard id="THEORY" label="Theory" description="Explain concepts and decisions" selected={questionTypes.includes('THEORY')} onClick={() => toggleQuestionType('THEORY')} />
                  <SelectorCard id="SYSTEM_DESIGN" label="System design" description="Trade-offs and architecture" selected={questionTypes.includes('SYSTEM_DESIGN')} onClick={() => toggleQuestionType('SYSTEM_DESIGN')} />
                  {mode === 'MIXED' && (
                    <SelectorCard id="CODING" label="Coding" description="Solve a problem in the editor" selected={questionTypes.includes('CODING')} onClick={() => toggleQuestionType('CODING')} />
                  )}
                </div>
              </motion.section>
            )}

            {/* 5. Time Limit */}
            <motion.section variants={fadeUpVariant} className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-md bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold flex items-center justify-center">
                    {stepNo('time')}
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                    Time Limit
                  </h2>
                </div>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Starts when you open the interview
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DURATION_OPTIONS.map((minutes) => (
                  <SelectorCard
                    key={minutes}
                    id={String(minutes)}
                    label={`${minutes} minutes`}
                    selected={duration === String(minutes)}
                    onClick={setDuration}
                  />
                ))}
              </div>
            </motion.section>
          </motion.div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: INTERVIEW OVERVIEW & SUMMARY (4 of 12)    */}
          {/* ======================================================== */}
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-4 space-y-4 lg:sticky lg:top-24 self-start"
          >
            {/* AI Interviewer Compact Card */}
            <Card className="glass-card-strong p-5 border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-900/25 via-transparent to-cyan-900/15 pointer-events-none" />

              <div className="relative z-10 flex items-center gap-3.5">
                {/* Compact Animated AI Avatar */}
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center relative shrink-0 shadow-inner">
                  <div className="absolute inset-0 rounded-xl border border-brand-500/30 animate-[spin_6s_linear_infinite]" />
                  <div className="absolute inset-1.5 rounded-lg border border-cyan-500/25 animate-[spin_8s_linear_infinite_reverse]" />
                  <BrainCircuit className="w-6 h-6 text-brand-300" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-semibold text-white truncate">
                      AI Interviewer
                    </h3>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    IntervAI Adaptive Engine
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="relative z-10 mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-400">Coach Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-medium ${
                    isValid ? 'text-cyan-300' : 'text-slate-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isValid ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-500'
                    }`}
                  />
                  {isValid ? 'Ready to initiate' : `${completedCount}/${totalSteps} configured`}
                </span>
              </div>
            </Card>

            {/* Session Summary & Action Card */}
            <Card className="glass-card-strong p-5 sm:p-6 border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">
                  Session Summary
                </h3>
                <span className="text-xs font-mono text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                  {completedCount}/{totalSteps} selected
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-5">
                <motion.div
                  className="h-full bg-gradient-to-r from-brand-500 to-cyan-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedCount / totalSteps) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Scannable Breakdown List */}
              <ul className="space-y-3.5 mb-6 text-xs sm:text-sm">
                {/* Mode */}
                <li className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/5">
                  <span className="flex items-center gap-2 text-slate-400">
                    <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
                    <span>Mode</span>
                  </span>
                  <span className="font-medium text-right text-white">
                    {mode === 'TOPIC' ? 'Topic' : mode === 'RESUME' ? 'Resume' : 'Mixed'}
                  </span>
                </li>

                {mode !== 'TOPIC' && (
                  <li className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/5">
                    <span className="flex items-center gap-2 text-slate-400">
                      <Target className="w-4 h-4 text-brand-300 shrink-0" />
                      <span>Role</span>
                    </span>
                    <span className={`font-medium text-right truncate max-w-[170px] ${targetRole.trim() ? 'text-white' : 'text-slate-500 italic'}`}>
                      {targetRole.trim() || 'Not entered'}
                    </span>
                  </li>
                )}

                {/* Type */}
                {mode !== 'RESUME' && (
                <li className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/5">
                  <span className="flex items-center gap-2 text-slate-400">
                    <Layers className="w-4 h-4 text-brand-400 shrink-0" />
                    <span>Type</span>
                  </span>
                  <span
                    className={`font-medium text-right truncate ${
                      selectedType ? 'text-white' : 'text-slate-500 italic'
                    }`}
                  >
                    {selectedType?.label || 'Not selected'}
                  </span>
                </li>

                )}

                {/* Difficulty */}
                <li className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/5">
                  <span className="flex items-center gap-2 text-slate-400">
                    <Gauge className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Difficulty</span>
                  </span>
                  <span
                    className={`font-medium text-right truncate ${
                      selectedDifficulty ? 'text-white' : 'text-slate-500 italic'
                    }`}
                  >
                    {selectedDifficulty?.label || 'Not selected'}
                  </span>
                </li>

                {/* Focus */}
                {mode !== 'RESUME' && (
                <li className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/5">
                  <span className="flex items-center gap-2 text-slate-400">
                    <Target className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Focus Area</span>
                  </span>
                  <span
                    className={`font-medium text-right truncate max-w-[170px] ${
                      selectedFocus ? 'text-white' : 'text-slate-500 italic'
                    }`}
                  >
                    {selectedFocus?.label || 'Not selected'}
                  </span>
                </li>

                )}

                {/* Time limit */}
                <li className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/5">
                  <span className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-4 h-4 text-rose-300 shrink-0" />
                    <span>Time Limit</span>
                  </span>
                  <span className="font-medium text-right text-white">{duration} minutes</span>
                </li>

                {/* Questions */}
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Questions</span>
                  </span>
                  <span className="font-medium text-right text-white">
                    {mode === 'TOPIC' ? `${plannedQuestionCount} questions` : `About ${plannedQuestionCount} questions`}
                  </span>
                </li>
              </ul>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs leading-relaxed"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Button */}
              <Button
                variant="glow"
                size="lg"
                className="w-full relative overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.99] group shadow-glow"
                onClick={handleStart}
                disabled={isPreparing}
              >
                {isPreparing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    <span>Preparing session...</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold">Start Interview</span>
                    <ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>

              {/* Status Hint */}
              {!isValid && !isPreparing && (
                <p className="text-[11px] text-slate-500 text-center mt-2.5">
                  Select all options above to begin
                </p>
              )}

              {isValid && !isPreparing && (
                <p className="text-[11px] text-cyan-400/80 text-center mt-2.5 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-cyan-400 inline" />
                  <span>All set! Ready to enter interview room</span>
                </p>
              )}
            </Card>
          </motion.aside>

        </div>
      </div>
    </div>
  );
}
