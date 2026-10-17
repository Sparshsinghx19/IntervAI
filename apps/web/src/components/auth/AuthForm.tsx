'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthProvider';
import { AuthField } from './AuthField';
import type { AuthFieldErrors } from '@/lib/auth-api';
import { PASSWORD_MIN_LENGTH, submitAuthForm } from '@/lib/auth-form';
import { buildAuthHref, getSafeRedirect } from '@/lib/safe-redirect';

type Mode = 'login' | 'signup';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const next = getSafeRedirect(nextParam);
  const { status, login, register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const refs = { name: nameRef, email: emailRef, password: passwordRef };

  // Already signed in (or just signed in): continue to the requested page.
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  const isSignup = mode === 'signup';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFormError('');

    const outcome = await submitAuthForm(mode, { name, email, password }, { login, register }, setSubmitting);
    if (outcome.ok) return; // The effect above navigates once the store reports the user.

    setFieldErrors(outcome.fieldErrors);
    setFormError(outcome.formError);
    if (outcome.clearPassword) setPassword('');
    if (outcome.focus === 'form') {
      // Wait for the alert to render before moving focus to it.
      requestAnimationFrame(() => errorRef.current?.focus());
    } else if (outcome.focus) {
      refs[outcome.focus].current?.focus();
    }
  };

  const clearFieldError = (field: keyof AuthFieldErrors) => {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const otherHref = buildAuthHref(isSignup ? '/login' : '/signup', nextParam);

  return (
    <form onSubmit={handleSubmit} noValidate aria-describedby={formError ? 'auth-form-error' : undefined} className="space-y-5">
      {formError && (
        <div
          id="auth-form-error"
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-400/25 bg-rose-500/[0.08] px-3.5 py-3 text-sm leading-snug text-rose-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <div className="space-y-4">
        {isSignup && (
          <AuthField
            ref={nameRef}
            id="name"
            label="Name"
            type="text"
            value={name}
            onChange={(v) => { setName(v); clearFieldError('name'); }}
            autoComplete="name"
            error={fieldErrors.name}
            disabled={submitting}
          />
        )}
        <AuthField
          ref={emailRef}
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(v) => { setEmail(v); clearFieldError('email'); }}
          autoComplete="email"
          error={fieldErrors.email}
          disabled={submitting}
        />
        <AuthField
          ref={passwordRef}
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(v) => { setPassword(v); clearFieldError('password'); }}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          error={fieldErrors.password}
          hint={isSignup ? `At least ${PASSWORD_MIN_LENGTH} characters.` : undefined}
          disabled={submitting}
        />
      </div>

      <Button
        type="submit"
        variant="glow"
        size="lg"
        className="group relative mt-2 w-full overflow-hidden shadow-glow focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian disabled:opacity-70"
        disabled={submitting}
        aria-busy={submitting}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span>{isSignup ? 'Creating account…' : 'Logging in…'}</span>
          </>
        ) : (
          <>
            <span className="font-semibold">{isSignup ? 'Create account' : 'Log in'}</span>
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </>
        )}
      </Button>

      <div className="flex items-center gap-3 pt-1" aria-hidden="true">
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">or</span>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>

      <p className="text-center text-sm text-slate-400">
        {isSignup ? 'Already have an account? ' : 'New to IntervAI? '}
        <Link
          href={otherHref}
          className="rounded font-medium text-brand-300 underline-offset-4 transition-colors hover:text-brand-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {isSignup ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </form>
  );
}
