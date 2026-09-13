'use client';

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Mic, BrainCircuit, Activity, TrendingUp, MessageSquare, Zap, Layers } from "lucide-react";
import { ThreeCoach } from "@/components/marketing/coach/ThreeCoach";

const USE_THREE_PROTOTYPE = true;

export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  // Premium continuous motions
  const float1: any = shouldReduceMotion ? {} : { y: [0, -10, 0], transition: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0 } };
  const float2: any = shouldReduceMotion ? {} : { y: [0, -12, 0], transition: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.5 } };
  const float3: any = shouldReduceMotion ? {} : { y: [0, -8, 0], transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 2 } };
  
  const breatheAnimation: any = shouldReduceMotion ? {} : {
    y: [0, -15, 0],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" }
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-glow-gradient pointer-events-none opacity-80" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <Badge variant="outline" className="mb-6 py-1.5 px-4 text-sm border-brand-500/30 bg-brand-500/10 text-brand-300">
              Introducing your intelligent AI coach
            </Badge>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8 leading-[1.1]">
              Master the Interview.<br/>
              <span className="text-gradient-brand">Powered by AI.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed">
              Practice technical and behavioral interviews with an adaptive AI coach. Get real-time feedback, identify weak points, and become interview-ready faster.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="glow" size="lg" className="w-full sm:w-auto transition-transform hover:scale-105 active:scale-95 duration-300">
                Start Practicing Free
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto transition-transform hover:scale-105 active:scale-95 duration-300">
                Watch Demo
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Hero Visual Mockup */}
        <div className="relative max-w-5xl mx-auto mt-12 flex flex-col items-center">
          
          {/* AI COACH VISUAL LAYER */}
          <div className="relative w-full h-[450px] flex items-center justify-center mb-4 z-20">
            
            {USE_THREE_PROTOTYPE ? (
              <ThreeCoach />
            ) : (
              <>
                {/* Holographic Platform */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[350px] h-24 z-0">
              <div className="absolute inset-0 border-[3px] border-brand-500/20 rounded-[50%] shadow-[0_0_40px_rgba(139,92,246,0.3)]" />
              <div className="absolute left-6 right-6 top-6 bottom-6 border border-cyan-500/30 rounded-[50%]" />
              <div className="absolute left-12 right-12 top-12 bottom-12 bg-brand-500/40 rounded-[50%] shadow-[0_0_80px_40px_rgba(139,92,246,0.5)] blur-md" />
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-40 bg-gradient-to-t from-brand-500/30 to-transparent blur-2xl rounded-t-full" />
            </div>

            {/* Central Floating Robot */}
            <motion.div animate={breatheAnimation} className="relative z-10 flex flex-col items-center mt-[-60px]">
              {/* Robot Head */}
              <div className="w-40 h-28 bg-gradient-to-b from-slate-200 to-slate-400 rounded-[3.5rem] shadow-[inset_0_-8px_20px_rgba(0,0,0,0.3),0_15px_30px_rgba(0,0,0,0.6)] flex items-center justify-center border-t border-white relative z-20 mb-[-20px]">
                {/* Visor */}
                <div className="w-32 h-16 bg-obsidian rounded-[2rem] shadow-[inset_0_6px_20px_rgba(0,0,0,1)] flex items-center justify-center border border-white/10 relative overflow-hidden">
                  <div className="flex gap-5">
                    <div className="w-6 h-3 bg-cyan-400 rounded-full shadow-[0_0_20px_#22d3ee]" style={{ clipPath: 'polygon(0 30%, 100% 0, 100% 100%, 0 100%)' }} />
                    <div className="w-6 h-3 bg-cyan-400 rounded-full shadow-[0_0_20px_#22d3ee]" style={{ clipPath: 'polygon(0 0, 100% 30%, 100% 100%, 0 100%)' }} />
                  </div>
                </div>
                {/* Antennas */}
                <div className="absolute -top-5 left-10 w-1.5 h-8 bg-slate-300 rounded-t-full shadow-sm" />
                <div className="absolute -top-5 right-10 w-1.5 h-8 bg-slate-300 rounded-t-full shadow-sm" />
                {/* Ears */}
                <div className="absolute -left-3 top-12 w-5 h-10 bg-slate-400 rounded-l-full shadow-inner border-y border-l border-white/50" />
                <div className="absolute -right-3 top-12 w-5 h-10 bg-slate-400 rounded-r-full shadow-inner border-y border-r border-white/50" />
              </div>
              
              {/* Robot Body */}
              <div className="w-56 h-48 bg-gradient-to-b from-slate-200 to-slate-500 rounded-[4rem] shadow-[inset_0_-20px_40px_rgba(0,0,0,0.5),0_25px_50px_rgba(139,92,246,0.3)] flex flex-col items-center justify-center relative z-10 border-t border-white/60">
                {/* Core/Chest */}
                <div className="mt-4 w-24 h-24 bg-obsidian rounded-full flex items-center justify-center border-4 border-brand-500/50 shadow-[inset_0_0_30px_rgba(139,92,246,0.8),0_0_50px_rgba(139,92,246,0.6)] relative overflow-hidden">
                  <span className="text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,1)] z-10">IV</span>
                  <div className="absolute inset-0 bg-brand-500/40 animate-pulse-glow" />
                </div>
                {/* Arms */}
                <div className="absolute -left-10 top-12 w-14 h-24 bg-gradient-to-b from-slate-300 to-slate-500 rounded-full shadow-[inset_0_-6px_15px_rgba(0,0,0,0.4),0_10px_20px_rgba(0,0,0,0.5)] origin-top rotate-[25deg] border-t border-white/60" />
                <div className="absolute -right-10 top-12 w-14 h-24 bg-gradient-to-b from-slate-300 to-slate-500 rounded-full shadow-[inset_0_-6px_15px_rgba(0,0,0,0.4),0_10px_20px_rgba(0,0,0,0.5)] origin-top -rotate-[25deg] border-t border-white/60" />
              </div>
            </motion.div>
            </>
            )}

            {/* FLOATING METRIC CARDS */}
            {/* Card 1: Score Trend */}
            <motion.div className="absolute top-8 left-4 lg:left-12 xl:left-0 z-30 hidden md:flex" animate={float1} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <Card className="p-4 bg-obsidian/90 border-brand-500/30 backdrop-blur-md shadow-2xl flex items-center gap-4 group hover:border-brand-500/60 transition-colors">
                <div className="p-2 bg-brand-500/20 rounded-lg text-brand-400 group-hover:scale-110 transition-transform"><TrendingUp className="w-5 h-5"/></div>
                <div><p className="text-xs text-slate-400">Score Trend</p><p className="text-lg font-bold text-white">+18%</p></div>
              </Card>
            </motion.div>

            {/* Card 2: Tech Accuracy */}
            <motion.div className="absolute top-1/2 -translate-y-1/2 -left-4 lg:-left-12 xl:-left-16 z-30 hidden md:flex" animate={float2} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
              <Card className="p-4 bg-obsidian/90 border-cyan-500/30 backdrop-blur-md shadow-2xl flex items-center gap-4 group hover:border-cyan-500/60 transition-colors">
                <div className="relative w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                    <circle cx="24" cy="24" r="20" stroke="#06b6d4" strokeWidth="4" fill="none" strokeDasharray="125" strokeDashoffset="10" strokeLinecap="round" />
                  </svg>
                  <span className="absolute text-xs font-bold text-white">92%</span>
                </div>
                <div><p className="text-xs text-slate-400">Technical<br/>Accuracy</p></div>
              </Card>
            </motion.div>

            {/* Card 3: Weak Topic */}
            <motion.div className="absolute bottom-16 left-8 lg:left-16 xl:left-8 z-30 hidden md:block" animate={float3} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
              <Card className="p-4 bg-obsidian/90 border-amber-500/30 backdrop-blur-md shadow-2xl w-48 group hover:border-amber-500/60 transition-colors">
                <p className="text-xs text-slate-400 mb-1">Weak Topic</p>
                <div className="flex justify-between items-center mb-2"><span className="text-sm font-semibold text-white">Graphs</span><span className="text-sm text-amber-400 font-bold">62%</span></div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-[62%] group-hover:opacity-80 transition-opacity" />
                </div>
              </Card>
            </motion.div>

            {/* Card 4: Communication */}
            <motion.div className="absolute top-12 right-4 lg:right-12 xl:right-0 z-30 hidden md:flex" animate={float3} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
              <Card className="p-4 bg-obsidian/90 border-cyan-500/30 backdrop-blur-md shadow-2xl flex items-center gap-4 group hover:border-cyan-500/60 transition-colors">
                <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400 group-hover:scale-110 transition-transform"><MessageSquare className="w-5 h-5"/></div>
                <div><p className="text-xs text-slate-400">Communication</p><p className="text-lg font-bold text-white">84%</p></div>
              </Card>
            </motion.div>

            {/* Card 5: Adaptive Difficulty */}
            <motion.div className="absolute top-1/2 -translate-y-1/2 -right-4 lg:-right-12 xl:-right-16 z-30 hidden md:flex" animate={float1} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
              <Card className="p-4 bg-obsidian/90 border-brand-500/30 backdrop-blur-md shadow-2xl flex items-center gap-4 group hover:border-brand-500/60 transition-colors">
                <div className="p-2 bg-brand-500/20 rounded-lg text-brand-400 group-hover:scale-110 transition-transform"><Zap className="w-5 h-5"/></div>
                <div><p className="text-xs text-slate-400">Adaptive Difficulty</p><p className="text-sm font-bold text-brand-400">Increasing ↑</p></div>
              </Card>
            </motion.div>

            {/* Card 6: Next Question */}
            <motion.div className="absolute bottom-12 right-8 lg:right-16 xl:right-8 z-30 hidden md:flex" animate={float2} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
              <Card className="p-4 bg-obsidian/90 border-white/20 backdrop-blur-md shadow-2xl flex items-center gap-4 group hover:border-white/40 transition-colors">
                <div className="p-2 bg-white/10 rounded-lg text-white group-hover:scale-110 transition-transform"><Layers className="w-5 h-5"/></div>
                <div><p className="text-xs text-slate-400">Next Question</p><p className="text-sm font-bold text-white">System Design</p></div>
              </Card>
            </motion.div>
          </div>

          {/* Connection Line */}
          <div className="w-px h-16 bg-gradient-to-b from-brand-500 to-transparent -mt-8 relative z-10 animate-pulse-glow" />

          {/* EXISTING INTERVIEW UI PANEL */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-20 w-full max-w-4xl"
          >
            <Card className="glass-card-strong relative border-white/20 p-0 overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
              <div className="border-b border-white/10 p-4 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center border border-brand-500/30">
                    <BrainCircuit className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">System Design Interview</h3>
                    <p className="text-xs text-slate-400">Senior Backend Engineer</p>
                  </div>
                </div>
                <Badge variant="success">Adaptive Mode Active</Badge>
              </div>
              
              <div className="p-8 pb-12 flex flex-col gap-6 relative">
                <div className="absolute left-12 top-[80px] bottom-16 w-px bg-gradient-to-b from-brand-500/50 to-cyan-500/10" />
                
                <div className="max-w-2xl pl-10 relative">
                  <div className="absolute left-[-5px] top-2 w-2.5 h-2.5 rounded-full bg-brand-500 shadow-glow" />
                  <p className="text-sm text-brand-400 font-medium mb-2">IntervAI Coach</p>
                  <h4 className="text-xl md:text-2xl text-white font-medium leading-relaxed">
                    "How would you approach designing a rate limiter for a distributed API that receives millions of requests per second?"
                  </h4>
                </div>
                
                <div className="mt-8 flex items-center gap-4 pl-10 relative">
                  <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-500 shadow-glow-cyan" />
                  <div className="flex-1 glass-card rounded-xl p-4 flex items-center gap-3 border-brand-500/30 bg-brand-500/10">
                    <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shadow-glow">
                      <Mic className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-brand-500" 
                          animate={{ width: ["30%", "60%", "40%"] }} 
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-brand-300">Listening...</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
