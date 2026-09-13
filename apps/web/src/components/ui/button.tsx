import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'glow';
  size?: 'default' | 'sm' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-50",
          {
            'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-500/20': variant === 'default',
            'bg-transparent border border-white/10 text-white hover:bg-white/5': variant === 'outline',
            'hover:bg-white/5 text-slate-300 hover:text-white': variant === 'ghost',
            'bg-gradient-to-r from-brand-600 to-cyan-600 text-white hover:opacity-90 shadow-glow': variant === 'glow',
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3': size === 'sm',
            'h-12 px-8 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
