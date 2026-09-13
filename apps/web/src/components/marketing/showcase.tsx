'use client';

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react";

const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const cardVariants: any = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

export function Showcase() {
  return (
    <section className="py-24 relative overflow-hidden" id="showcase">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">See How IntervAI Evaluates</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Our intelligent coach analyzes your response in real-time, providing actionable feedback on technical accuracy, concepts covered, and communication style.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: The "User Answer" */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="p-8 border-white/10 relative hover:border-white/20 transition-colors duration-500">
              <div className="absolute top-0 right-0 p-4">
                <Badge variant="outline">Candidate Response</Badge>
              </div>
              <div className="flex gap-4 mb-6 group">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <MessageSquare className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                </div>
                <div className="prose prose-invert">
                  <p className="text-slate-300 leading-relaxed text-sm md:text-base">
                    "I would use a Token Bucket algorithm backed by Redis. Each user gets a bucket with a capacity, and tokens are added at a fixed rate. When a request comes in, we check if there's a token. <span className="bg-brand-500/20 text-white rounded px-1 border-b border-brand-500">If not, we drop the request.</span> This allows for burst traffic while maintaining an overall rate limit."
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Right: The "AI Evaluation" (Staggered Cards) */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="flex flex-col gap-4"
          >
            <motion.div variants={cardVariants}>
              <Card className="border-brand-500/30 bg-brand-500/5 flex items-start gap-4 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(139,92,246,0.2)] hover:border-brand-500/50 hover:bg-brand-500/10 group">
                <CheckCircle2 className="w-6 h-6 text-brand-400 shrink-0 mt-1 transition-transform duration-300 group-hover:scale-110" />
                <div>
                  <h4 className="text-white font-semibold mb-1">Strong Technical Foundation</h4>
                  <p className="text-sm text-slate-400">Correctly identified Token Bucket as the optimal algorithm and Redis as the data store for distributed environments.</p>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
              <Card className="border-amber-500/30 bg-amber-500/5 flex items-start gap-4 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(245,158,11,0.15)] hover:border-amber-500/50 hover:bg-amber-500/10 group">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-1 transition-transform duration-300 group-hover:scale-110" />
                <div>
                  <h4 className="text-white font-semibold mb-1">Missing Edge Case</h4>
                  <p className="text-sm text-slate-400">You didn't mention how to handle race conditions in Redis (e.g., using Lua scripts) when multiple instances decrement the bucket simultaneously.</p>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
              <Card className="border-cyan-500/30 bg-cyan-500/5 flex items-start gap-4 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(6,182,212,0.2)] hover:border-cyan-500/50 hover:bg-cyan-500/10 group">
                <Lightbulb className="w-6 h-6 text-cyan-400 shrink-0 mt-1 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5" />
                <div>
                  <h4 className="text-white font-semibold mb-1">Adaptive Next Question</h4>
                  <p className="text-sm text-slate-400">"How would you ensure atomicity when updating the token count in Redis?"</p>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
