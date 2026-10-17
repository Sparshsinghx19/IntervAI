export type UserRole = 'USER' | 'ADMIN';

/** The only user fields ever returned to clients. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** Authenticated caller, resolved server-side from a valid session cookie. */
export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  name: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      principal?: AuthPrincipal;
    }
  }
}

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
