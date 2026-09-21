'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, SkipForward, AlertCircle, RefreshCcw, Send, BrainCircuit, CheckCircle2 } from 'lucide-react';

import { Navbar } from '@/components/marketing/navbar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getMockQuestions, MockQuestion, SessionConfig } from '@/data/mock-interview';
import { Textarea } from '@/components/ui/textarea';

type AIStatus = 'LISTENING' | 'EVALUATING' | 'COMPLETED';

export default function InterviewSession() {
  const router = useRouter();

  // Config State
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Session State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [validationError, setValidationError] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  // AI State
  const [aiStatus, setAiStatus] = useState<AIStatus>('LISTENING');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Load config on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('intervai-interview-config');
      if (stored) {
        const parsed = JSON.parse(stored) as SessionConfig;
        if (parsed.interviewType && parsed.difficulty && parsed.focusArea && parsed.questionCount) {
          setConfig(parsed);
          setQuestions(getMockQuestions(parsed));
        }
      }
    } catch (e) {
      console.error('Failed to parse config from sessionStorage');
    } finally {
      setIsConfigLoaded(true);
    }
  }, []);

  // 2. Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConfigLoaded && config && aiStatus !== 'COMPLETED') {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConfigLoaded, config, aiStatus]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // If loading
  if (!isConfigLoaded) {
    return (
      <div className="min-h-screen bg-obsidian text-foreground flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  // If missing/invalid config
  if (!config) {
    return (
      <div className="min-h-screen bg-obsidian text-foreground flex flex-col items-center justify-center p-4">
        <Navbar mode="session" />
        <Card className="glass-card-strong p-8 max-w-md w-full text-center border-white/10 space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">Session Not Found</h2>
          <p className="text-slate-400">
            We couldn't find your interview configuration. Please return to the setup page and try again.
          </p>
          <Button 
            variant="glow" 
            className="w-full"
            onClick={() => router.push('/interview')}
          >
            Back to Setup
          </Button>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isFinalQuestion = currentIndex === questions.length - 1;

  const handleNext = () => {
    setAnswer('');
    setValidationError('');
    setIsSubmitting(false);
    
    if (isFinalQuestion) {
      setAiStatus('COMPLETED');
    } else {
      setCurrentIndex((prev) => prev + 1);
      setAiStatus('LISTENING');
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim()) {
      setValidationError('Please provide an answer before submitting.');
      return;
    }

    setValidationError('');
    setIsSubmitting(true);
    setAiStatus('EVALUATING');

    // Simulate analysis delay
    setTimeout(() => {
      handleNext();
    }, 2000);
  };

  const handleSkip = () => {
    handleNext();
  };

  // UI for AI Interviewer
  const renderAIPanel = () => {
    let aiVisuals = '';
    let aiText = '';

    if (aiStatus === 'LISTENING') {
      aiVisuals = 'border-brand-500/30 animate-pulse bg-brand-900/10';
      aiText = 'Listening...';
    } else if (aiStatus === 'EVALUATING') {
      aiVisuals = 'border-cyan-500/50 animate-[pulse_0.5s_ease-in-out_infinite] bg-cyan-900/20 shadow-[0_0_15px_rgba(6,182,212,0.3)]';
      aiText = 'Analyzing response...';
    } else {
      aiVisuals = 'border-white/10 bg-white/5';
      aiText = 'Session Completed';
    }

    return (
      <div className="relative rounded-2xl overflow-hidden glass-card p-1 border border-white/10 h-[300px] flex flex-col transition-all duration-500">
        <div className={`absolute inset-0 z-0 transition-colors duration-500 ${aiStatus === 'EVALUATING' ? 'bg-gradient-to-br from-brand-900/40 to-cyan-900/40' : 'bg-gradient-to-br from-brand-900/10 to-obsidian'}`} />
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className={`w-24 h-24 rounded-full border flex items-center justify-center mb-6 relative transition-all duration-500 ${aiVisuals}`}>
            {aiStatus === 'EVALUATING' && (
              <>
                <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-[spin_1s_linear_infinite]" />
                <div className="absolute inset-2 rounded-full border-b-2 border-brand-400 animate-[spin_1.5s_linear_infinite_reverse]" />
              </>
            )}
            {aiStatus === 'LISTENING' && (
              <div className="absolute inset-0 rounded-full border border-brand-500/50 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
            )}
            <BrainCircuit className={`w-10 h-10 ${aiStatus === 'COMPLETED' ? 'text-slate-500' : 'text-brand-300'}`} />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">AI Interviewer</h3>
          <p className={`text-sm ${aiStatus === 'EVALUATING' ? 'text-cyan-400' : 'text-slate-400'}`}>
            {aiText}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-obsidian text-foreground selection:bg-brand-500/30">
      <Navbar mode="session" />
      <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none" />
      <div className="absolute inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 flex flex-col md:flex-row gap-8">
        
        {/* Left Column: AI Panel & Progress */}
        <div className="w-full md:w-1/3 space-y-6">
          {renderAIPanel()}
          
          {/* Progress Card */}
          <Card className="glass-card-strong p-6 border-white/10">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400 text-sm">Progress</span>
              <span className="text-white font-medium text-sm">
                {aiStatus === 'COMPLETED' ? questions.length : currentIndex + 1} / {questions.length}
              </span>
            </div>
            
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mb-6">
              <div 
                className="bg-gradient-to-r from-brand-500 to-cyan-500 h-full transition-all duration-500 ease-out"
                style={{ width: `${((aiStatus === 'COMPLETED' ? questions.length : currentIndex) / questions.length) * 100}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Session Timer</span>
              <span className="text-white font-mono">{formatTime(timerSeconds)}</span>
            </div>
          </Card>
        </div>

        {/* Right Column: Interaction */}
        <div className="w-full md:w-2/3 flex flex-col">
          <AnimatePresence mode="wait">
            {aiStatus === 'COMPLETED' ? (
              <motion.div
                key="completed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex-1 flex"
              >
                <Card className="glass-card flex-1 p-10 border-brand-500/20 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-brand-500/10 flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-10 h-10 text-brand-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white">Interview Complete</h2>
                  <p className="text-lg text-slate-300 max-w-md">
                    Your interview session is complete. Results and AI feedback will be added in the next stage.
                  </p>
                  <div className="pt-8">
                    <Button 
                      variant="glow" 
                      size="lg"
                      onClick={() => router.push('/interview')}
                    >
                      Back to Interview Setup
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key={`question-${currentIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="flex-1 flex flex-col space-y-6"
              >
                {/* Question */}
                <Card className="glass-card-strong p-8 border-white/10 flex-1 flex flex-col">
                  {questions.length < parseInt(config.questionCount, 10) && currentIndex === 0 && (
                    <div className="mb-6 p-4 rounded-lg bg-cyan-900/20 border border-cyan-500/20 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-cyan-200">
                        We couldn't find enough questions matching your exact criteria. We've provided the closest available questions within your focus area.
                      </p>
                    </div>
                  )}

                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-medium uppercase tracking-wider mb-6 self-start">
                    Question {currentIndex + 1}
                  </div>
                  
                  <h2 className="text-2xl md:text-3xl font-semibold text-white leading-tight mb-8">
                    {currentQuestion?.question}
                  </h2>
                  
                  <div className="mt-auto space-y-4">
                    <Textarea 
                      placeholder="Type your response here..."
                      className="min-h-[160px] bg-obsidian border-white/10 text-white placeholder:text-slate-500 resize-none focus-visible:ring-brand-500"
                      value={answer}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        setAnswer(e.target.value);
                        if (validationError) setValidationError('');
                      }}
                      disabled={isSubmitting}
                    />
                    
                    <AnimatePresence>
                      {validationError && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-red-400 text-sm"
                        >
                          {validationError}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Card>

                {/* Actions */}
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1 border-white/10 hover:bg-white/5 text-slate-300"
                    onClick={handleSkip}
                    disabled={isSubmitting}
                  >
                    Skip Question
                    <SkipForward className="w-4 h-4 ml-2" />
                  </Button>
                  
                  <Button
                    variant="glow"
                    className="flex-[2] relative overflow-hidden"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Answer
                        <Send className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
