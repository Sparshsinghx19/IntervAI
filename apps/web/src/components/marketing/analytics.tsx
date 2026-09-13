'use client';

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { mockInterviewStats } from "@/data/mock-data";

export function Analytics() {
  return (
    <section className="py-24 relative overflow-hidden" id="analytics">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-glow-gradient opacity-50 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Track Your Progress</h2>
            <p className="text-slate-400 text-lg mb-8 leading-relaxed">
              IntervAI doesn't just evaluate single answers; it builds a comprehensive profile of your technical strengths and weaknesses over time. Watch your average score improve as you practice.
            </p>
            
            <div className="grid grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className="border-brand-500/20 bg-brand-500/5 transition-colors hover:bg-brand-500/10 hover:border-brand-500/40">
                  <p className="text-sm text-slate-400 mb-1">Total Interviews</p>
                  <p className="text-3xl font-bold text-white">12</p>
                </Card>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className="border-cyan-500/20 bg-cyan-500/5 transition-colors hover:bg-cyan-500/10 hover:border-cyan-500/40">
                  <p className="text-sm text-slate-400 mb-1">Current Avg. Score</p>
                  <p className="text-3xl font-bold text-cyan-400">92%</p>
                </Card>
              </motion.div>
            </div>
          </motion.div>

          {/* Right Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-[400px]"
          >
            <Card className="w-full h-full p-6 border-white/10 flex flex-col transition-all duration-500 hover:shadow-glow hover:border-brand-500/20">
              <h3 className="text-white font-medium mb-6">Performance Trend</h3>
              <div className="flex-1 min-h-0 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockInterviewStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="attempt" 
                      stroke="rgba(255,255,255,0.4)" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.4)" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      domain={[50, 100]}
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#05050A', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', boxShadow: '0 10px 30px -10px rgba(139,92,246,0.3)' }}
                      itemStyle={{ color: '#F8FAFC', fontWeight: 600 }}
                      cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#8b5cf6" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#05050A' }}
                      activeDot={{ r: 6, fill: '#22d3ee', stroke: '#05050A', strokeWidth: 2 }}
                      name="Score"
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
