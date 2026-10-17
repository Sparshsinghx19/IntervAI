export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;

// Pragmatic shape check: one "@", no whitespace, a dot in the domain.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: FieldErrors };

/** Single normalisation used for storage, lookup and uniqueness. */
export const normalizeEmail = (email: string): string => email.normalize('NFKC').trim().toLowerCase();

const validateEmail = (raw: unknown, errors: FieldErrors): string => {
  if (typeof raw !== 'string' || raw.trim() === '') {
    errors.email = 'Email is required.';
    return '';
  }
  const email = normalizeEmail(raw);
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  return email;
};

export const validateRegistration = (
  body: unknown
): ValidationResult<{ name: string; email: string; password: string }> => {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  let name = '';
  if (typeof input.name !== 'string' || input.name.trim() === '') {
    errors.name = 'Name is required.';
  } else {
    name = input.name.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (name.length > NAME_MAX_LENGTH) {
      errors.name = `Name must be at most ${NAME_MAX_LENGTH} characters.`;
    } else if (CONTROL_CHARS.test(name)) {
      errors.name = 'Name contains invalid characters.';
    }
  }

  const email = validateEmail(input.email, errors);

  const password = input.password;
  if (typeof password !== 'string' || password.length === 0) {
    errors.password = 'Password is required.';
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  } else if (password.trim() === '') {
    errors.password = 'Password cannot be only spaces.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { name, email, password: password as string } };
};

export const validateLogin = (
  body: unknown
): ValidationResult<{ email: string; password: string }> => {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const email = validateEmail(input.email, errors);

  const password = input.password;
  if (typeof password !== 'string' || password.length === 0) {
    errors.password = 'Password is required.';
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    // Bound hashing work; such a password can never match a stored one.
    errors.password = `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { email, password: password as string } };
};
