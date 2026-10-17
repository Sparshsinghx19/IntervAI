import type { AuthFieldErrors, AuthResult } from './auth-api';

// Mirrors the API rules so users get instant feedback; the API still validates everything.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 80;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailError(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  if (trimmed.length > 254 || !EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.';
  return undefined;
}

export function validateLoginForm(values: { email: string; password: string }): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const email = emailError(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = 'Password is required.';
  return errors;
}

export function validateSignupForm(values: { name: string; email: string; password: string }): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Name is required.';
  else if (name.length > NAME_MAX_LENGTH) errors.name = `Name must be at most ${NAME_MAX_LENGTH} characters.`;

  const email = emailError(values.email);
  if (email) errors.email = email;

  if (!values.password) errors.password = 'Password is required.';
  else if (values.password.length < PASSWORD_MIN_LENGTH) errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  else if (values.password.length > PASSWORD_MAX_LENGTH) errors.password = `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  else if (!values.password.trim()) errors.password = 'Password cannot be only spaces.';
  return errors;
}

/** First field (in on-screen order) that has an error, for moving focus there. */
export function firstInvalidField(errors: AuthFieldErrors): keyof AuthFieldErrors | null {
  for (const field of ['name', 'email', 'password'] as const) {
    if (errors[field]) return field;
  }
  return null;
}

export type AuthFormMode = 'login' | 'signup';

export interface AuthFormValues {
  name: string;
  email: string;
  password: string;
}

export interface AuthFormActions {
  login: (input: { email: string; password: string }) => Promise<AuthResult>;
  register: (input: { name: string; email: string; password: string }) => Promise<AuthResult>;
}

export interface AuthSubmitOutcome {
  ok: boolean;
  fieldErrors: AuthFieldErrors;
  formError: string;
  /** Where keyboard focus should go next. */
  focus: keyof AuthFieldErrors | 'form' | null;
  clearPassword: boolean;
}

/**
 * Runs one login/sign-up submission: client validation, the API call and
 * mapping of the result to what the form shows. `setSubmitting` drives the
 * loading state and stays true on success while the page navigates away.
 */
export async function submitAuthForm(
  mode: AuthFormMode,
  values: AuthFormValues,
  actions: AuthFormActions,
  setSubmitting: (submitting: boolean) => void
): Promise<AuthSubmitOutcome> {
  const isSignup = mode === 'signup';
  const errors = isSignup ? validateSignupForm(values) : validateLoginForm(values);
  const invalid = firstInvalidField(errors);
  if (invalid) {
    return { ok: false, fieldErrors: errors, formError: '', focus: invalid, clearPassword: false };
  }

  setSubmitting(true);
  const email = values.email.trim();
  const result = isSignup
    ? await actions.register({ name: values.name.trim(), email, password: values.password })
    : await actions.login({ email, password: values.password });

  if (result.ok) {
    return { ok: true, fieldErrors: {}, formError: '', focus: null, clearPassword: false };
  }

  setSubmitting(false);
  const fieldErrors: AuthFieldErrors = { ...(result.fieldErrors ?? {}) };
  if (isSignup && result.status === 409) fieldErrors.email = result.error;

  const fieldToFocus = firstInvalidField(fieldErrors);
  if (fieldToFocus) {
    return { ok: false, fieldErrors, formError: '', focus: fieldToFocus, clearPassword: false };
  }

  const wrongCredentials = !isSignup && result.status === 401;
  return {
    ok: false,
    fieldErrors,
    formError: result.error,
    focus: wrongCredentials ? 'password' : 'form',
    clearPassword: wrongCredentials,
  };
}
