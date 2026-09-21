'use client';

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SelectorCardProps {
  id: string;
  label: string;
  description?: string;
  selected: boolean;
  onClick: (id: string) => void;
}

export function SelectorCard({ id, label, description, selected, onClick }: SelectorCardProps) {
  return (
    <motion.button
      type="button"
      onClick={() => onClick(id)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative flex flex-col items-start w-full p-4 rounded-xl text-left transition-all duration-300",
        "border backdrop-blur-md",
        selected 
          ? "bg-brand-500/10 border-brand-500/50 shadow-glow" 
          : "bg-obsidian/50 border-white/5 hover:border-white/20 hover:bg-white/[0.02]"
      )}
    >
      <span className={cn(
        "font-semibold mb-1 transition-colors",
        selected ? "text-brand-300" : "text-white"
      )}>
        {label}
      </span>
      {description && (
        <span className={cn(
          "text-sm transition-colors",
          selected ? "text-brand-200/70" : "text-slate-400"
        )}>
          {description}
        </span>
      )}
      
      {selected && (
        <motion.div
          layoutId="active-indicator"
          className="absolute inset-0 rounded-xl border border-brand-400/30 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </motion.button>
  );
}
