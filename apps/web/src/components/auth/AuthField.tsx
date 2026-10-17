'use client';

import { useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthFieldProps {
  id: string;
  label: string;
  type: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

export function AuthField({ id, label, type, value, onChange, autoComplete, error, hint, disabled, ref }: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[13px] font-medium tracking-wide text-slate-200">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          name={id}
          type={isPassword && visible ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize={type === 'text' ? 'words' : 'none'}
          readOnly={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 w-full rounded-xl border bg-white/[0.04] px-4 text-[15px] text-white placeholder:text-slate-500',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none',
            'focus:outline-none focus:bg-white/[0.06] focus-visible:ring-4',
            isPassword && 'pr-12',
            error
              ? 'border-rose-400/50 focus:border-rose-300/70 focus-visible:ring-rose-500/20'
              : 'border-white/[0.1] hover:border-white/20 focus:border-brand-400/70 focus-visible:ring-brand-500/20',
            disabled && 'cursor-progress opacity-70'
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            aria-controls={id}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none"
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-xs text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
