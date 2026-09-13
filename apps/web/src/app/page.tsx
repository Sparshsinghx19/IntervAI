'use client';

import { motion } from "framer-motion";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Showcase } from "@/components/marketing/showcase";
import { Analytics } from "@/components/marketing/analytics";
import { Footer } from "@/components/marketing/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Zap, FileText, ChevronRight } from "lucide-react";

// Shared animation variants
const staggerContainer: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const fadeUpVariant: any = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-obsidian text-foreground selection:bg-brand-500/30">
      <Navbar />
      
      <main>
        <Hero />
        
        {/* TRUST / CREDIBILITY (Placeholder) */}
        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="py-12 border-y border-white/5 bg-white/[0.01]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-8">Trusted by candidates landing offers at top tech companies</p>
            <div className="flex flex-wrap justify-center gap-12 opacity-40 grayscale hover:grayscale-0 hover:opacity-70 transition-all duration-700">
              <span className="text-xl font-bold transition-transform hover:scale-105 cursor-default">TECHCORP</span>
              <span className="text-xl font-bold transition-transform hover:scale-105 cursor-default">INNOVATE</span>
              <span className="text-xl font-bold transition-transform hover:scale-105 cursor-default">CLOUDNET</span>
              <span className="text-xl font-bold transition-transform hover:scale-105 cursor-default">FINTECH</span>
            </div>
          </div>
        </motion.section>

        {/* HOW IT WORKS */}
        <section className="py-24 relative" id="how-it-works">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div 
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Your Path to the Offer</h2>
            </motion.div>
            
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid md:grid-cols-4 gap-8"
            >
              {[
                { step: "01", title: "Choose Track", desc: "Select from Technical, Behavioral, or System Design." },
                { step: "02", title: "Practice", desc: "Engage in a live mock interview with your AI coach." },
                { step: "03", title: "Get Feedback", desc: "Receive instant, actionable evaluation on your answers." },
                { step: "04", title: "Improve", desc: "Review your weak areas and practice targeted concepts." },
              ].map((item) => (
                <motion.div key={item.step} variants={fadeUpVariant} className="relative group cursor-default">
                  <div className="text-5xl font-extrabold text-white/5 mb-4 transition-colors duration-500 group-hover:text-brand-500/20">{item.step}</div>
                  <h3 className="text-xl font-semibold text-white mb-2 transition-transform duration-300 group-hover:translate-x-1">{item.title}</h3>
                  <p className="text-slate-400 group-hover:text-slate-300 transition-colors">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <Showcase />

        {/* FEATURES GRID */}
        <section className="py-24 bg-white/[0.01] border-y border-white/5" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div 
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Everything You Need to Succeed</h2>
            </motion.div>
            
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid md:grid-cols-3 gap-8"
            >
              <motion.div variants={fadeUpVariant}>
                <Card className="h-full bg-obsidian/50 border-white/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_40px_-10px_rgba(139,92,246,0.2)] hover:border-brand-500/40 hover:bg-brand-500/5 group">
                  <Target className="w-10 h-10 text-brand-400 mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1" />
                  <h3 className="text-xl font-semibold text-white mb-3">Adaptive Difficulty</h3>
                  <p className="text-slate-400">IntervAI adjusts the complexity of follow-up questions based on how well you answered the previous one, just like a real interviewer.</p>
                </Card>
              </motion.div>
              
              <motion.div variants={fadeUpVariant}>
                <Card className="h-full bg-obsidian/50 border-white/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_40px_-10px_rgba(6,182,212,0.2)] hover:border-cyan-500/40 hover:bg-cyan-500/5 group">
                  <FileText className="w-10 h-10 text-cyan-400 mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1" />
                  <h3 className="text-xl font-semibold text-white mb-3">Resume-Based (Coming Soon)</h3>
                  <p className="text-slate-400">Upload your resume and the AI will tailor questions specific to the projects and experience you listed.</p>
                </Card>
              </motion.div>

              <motion.div variants={fadeUpVariant}>
                <Card className="h-full bg-obsidian/50 border-white/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_40px_-10px_rgba(139,92,246,0.2)] hover:border-brand-500/40 hover:bg-brand-500/5 group">
                  <Zap className="w-10 h-10 text-brand-400 mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1" />
                  <h3 className="text-xl font-semibold text-white mb-3">Targeted Feedback</h3>
                  <p className="text-slate-400">Identify exactly which concepts you missed. IntervAI highlights the precise gaps in your technical knowledge.</p>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <Analytics />

        {/* FINAL CTA */}
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-glow-gradient opacity-60 pointer-events-none" />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl mx-auto px-4 text-center relative z-10"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">Ready to ace your next interview?</h2>
            <p className="text-xl text-slate-400 mb-10">Join thousands of candidates who practice with IntervAI.</p>
            <Button variant="glow" size="lg" className="gap-2 group transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(139,92,246,0.5)]">
              Start Your First Interview 
              <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </motion.div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
