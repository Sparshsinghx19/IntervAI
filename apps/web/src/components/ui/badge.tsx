import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'outline';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          'border-transparent bg-brand-500/20 text-brand-400': variant === 'default',
          'border-transparent bg-cyan-500/20 text-cyan-400': variant === 'success',
          'border-transparent bg-amber-500/20 text-amber-400': variant === 'warning',
          'border-white/10 text-slate-300': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
