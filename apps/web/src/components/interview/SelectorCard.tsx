'use client';

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectorCardProps {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  selected: boolean;
  onClick: (id: string) => void;
  className?: string;
}

export function SelectorCard({
  id,
  label,
  description,
  badge,
  selected,
  onClick,
  className,
}: SelectorCardProps) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onClick(id)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "group relative flex flex-col items-start w-full text-left rounded-xl transition-all duration-200",
        "border backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian",
        description ? "p-4 sm:p-4.5 min-h-[92px]" : "py-3 px-3.5 sm:py-3.5 sm:px-4",
        selected
          ? "bg-gradient-to-br from-brand-500/15 via-brand-500/5 to-cyan-500/10 border-brand-500/60 ring-1 ring-brand-500/30 shadow-[0_0_24px_rgba(139,92,246,0.18)]"
          : "bg-obsidian/70 border-white/10 hover:border-white/25 hover:bg-white/[0.03]",
        className
      )}
    >
      <div className="flex items-center justify-between w-full gap-2 mb-1">
        <span
          className={cn(
            "font-semibold text-sm sm:text-base leading-snug transition-colors tracking-tight",
            selected ? "text-white" : "text-slate-200 group-hover:text-white"
          )}
        >
          {label}
        </span>

        {/* Accessible checkmark indicator (distinguishable without relying on color alone) */}
        <div
          className={cn(
            "w-4 h-4 rounded-full flex items-center justify-center transition-all shrink-0 ml-1.5",
            selected
              ? "bg-brand-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.6)]"
              : "border border-white/20 group-hover:border-white/40"
          )}
        >
          {selected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
        </div>
      </div>

      {badge && (
        <span
          className={cn(
            "text-[10px] uppercase font-mono px-1.5 py-0.5 rounded tracking-wider mb-1",
            selected ? "bg-brand-500/20 text-brand-300" : "bg-white/5 text-slate-400"
          )}
        >
          {badge}
        </span>
      )}

      {description && (
        <p
          className={cn(
            "text-xs leading-relaxed transition-colors mt-auto",
            selected ? "text-brand-200/80" : "text-slate-400 group-hover:text-slate-300"
          )}
        >
          {description}
        </p>
      )}
    </motion.button>
  );
}
