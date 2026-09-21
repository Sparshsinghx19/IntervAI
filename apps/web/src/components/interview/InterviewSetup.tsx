'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, BrainCircuit, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Navbar } from '@/components/marketing/navbar';
import { SelectorCard } from './SelectorCard';
import { interviewTypes, difficulties, focusAreas, questionCounts } from '@/data/interview-options';

const staggerContainer: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const fadeUpVariant: any = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

export function InterviewSetup() {
  const router = useRouter();
  
  const [interviewType, setInterviewType] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [focusArea, setFocusArea] = useState<string>('');
  const [questionCount, setQuestionCount] = useState<string>('');
  
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState('');

  const isValid = interviewType && difficulty && focusArea && questionCount;

  const handleStart = () => {
    if (!isValid) {
      setError('Please select all options before continuing.');
      return;
    }
    setError('');
    setIsPreparing(true);
    
    // Store configuration in sessionStorage
    sessionStorage.setItem('intervai-interview-config', JSON.stringify({
      interviewType,
      difficulty,
      focusArea,
      questionCount
    }));

    // Simulate brief preparation before navigation
    setTimeout(() => {
      router.push('/interview/session');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-obsidian text-foreground selection:bg-brand-500/30">
      <Navbar mode="app" />
      <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none" />
      <div className="absolute inset-0 bg-glow-gradient opacity-40 pointer-events-none" />
      
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
        
        {/* Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Prepare your interview</h1>
          <p className="text-lg text-slate-400">Customize your session. Your AI Coach will adapt as you progress.</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-12">
          {/* Configuration Options */}
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="lg:col-span-2 space-y-10"
          >
            
            {/* Interview Type */}
            <motion.section variants={fadeUpVariant}>
              <h2 className="text-xl font-semibold text-white mb-4">Interview type</h2>
              <div className="grid sm:grid-cols-3 gap-4">
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

            {/* Difficulty */}
            <motion.section variants={fadeUpVariant}>
              <h2 className="text-xl font-semibold text-white mb-4">Difficulty</h2>
              <div className="grid sm:grid-cols-3 gap-4">
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

            {/* Focus Area */}
            <motion.section variants={fadeUpVariant}>
              <h2 className="text-xl font-semibold text-white mb-4">Focus area</h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
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

            {/* Question Count */}
            <motion.section variants={fadeUpVariant}>
              <h2 className="text-xl font-semibold text-white mb-4">Question count</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {questionCounts.map((opt) => (
                  <SelectorCard 
                    key={opt.id}
                    id={opt.id}
                    label={opt.label}
                    selected={questionCount === opt.id}
                    onClick={setQuestionCount}
                  />
                ))}
              </div>
            </motion.section>

          </motion.div>

          {/* Right Column: AI Coach Preview & Summary */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-6"
          >
            {/* AI Coach Preview Placeholder */}
            <div className="relative rounded-2xl overflow-hidden glass-card p-1 border border-white/10 aspect-square sm:aspect-video lg:aspect-square flex flex-col">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 to-cyan-900/20 z-0" />
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 rounded-full border border-brand-500/30 animate-[spin_4s_linear_infinite]" />
                  <div className="absolute inset-2 rounded-full border border-cyan-500/20 animate-[spin_5s_linear_infinite_reverse]" />
                  <BrainCircuit className="w-8 h-8 text-brand-300" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">AI Interviewer</h3>
                <p className="text-sm text-slate-400">Waiting for session configuration...</p>
              </div>
            </div>

            {/* Summary & CTA */}
            <Card className="glass-card-strong p-6 border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Session Summary</h3>
              
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex justify-between">
                  <span className="text-slate-400">Type</span>
                  <span className="text-white font-medium">{interviewTypes.find(t => t.id === interviewType)?.label || '—'}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-400">Difficulty</span>
                  <span className="text-white font-medium">{difficulties.find(d => d.id === difficulty)?.label || '—'}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-400">Focus</span>
                  <span className="text-white font-medium">{focusAreas.find(f => f.id === focusArea)?.label || '—'}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-400">Questions</span>
                  <span className="text-white font-medium">{questionCounts.find(q => q.id === questionCount)?.label || '—'}</span>
                </li>
              </ul>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-red-400 text-sm mb-4 text-center"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button 
                variant="glow" 
                size="lg" 
                className="w-full relative overflow-hidden"
                onClick={handleStart}
                disabled={isPreparing}
              >
                {isPreparing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Preparing session...
                  </>
                ) : (
                  <>
                    Start Interview
                    <ChevronLeft className="w-4 h-4 ml-2 rotate-180" />
                  </>
                )}
              </Button>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
