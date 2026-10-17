import {
  AuthResult,
  AuthUser,
  CurrentUserResult,
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from './auth-api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /**
   * An API call was rejected with 401 while the page was in use. The page stays
   * mounted (so drafts survive) and the UI asks the user to log in again.
   */
  sessionExpired: boolean;
}

export interface AuthApi {
  fetchCurrentUser: () => Promise<CurrentUserResult>;
  loginUser: (input: { email: string; password: string }) => Promise<AuthResult>;
  registerUser: (input: { name: string; email: string; password: string }) => Promise<AuthResult>;
  logoutUser: () => Promise<{ ok: boolean }>;
}

const defaultApi: AuthApi = {
  fetchCurrentUser: () => fetchCurrentUser(),
  loginUser: (input) => loginUser(input),
  registerUser: (input) => registerUser(input),
  logoutUser: () => logoutUser(),
};

export const INITIAL_AUTH_STATE: AuthState = { status: 'loading', user: null, sessionExpired: false };

/**
 * Holds the current user in memory only. Credentials live in the HttpOnly
 * cookie; nothing is written to localStorage or sessionStorage.
 */
export function createAuthStore(api: AuthApi = defaultApi) {
  let state: AuthState = INITIAL_AUTH_STATE;
  const listeners = new Set<() => void>();

  const setState = (next: AuthState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  const signedIn = (user: AuthUser) => setState({ status: 'authenticated', user, sessionExpired: false });

  return {
    getState: (): AuthState => state,

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Restores the signed-in user from the session cookie (page load, or after re-login elsewhere). */
    async restore(): Promise<CurrentUserResult> {
      const result = await api.fetchCurrentUser();
      if (result.status === 'authenticated') {
        signedIn(result.user);
      } else if (state.sessionExpired) {
        // Keep the current page (and its drafts) mounted until the user logs in again.
      } else if (result.status === 'unauthenticated') {
        setState({ status: 'unauthenticated', user: null, sessionExpired: false });
      } else if (state.status === 'loading') {
        setState({ status: 'error', user: null, sessionExpired: false });
      }
      return result;
    },

    async login(input: { email: string; password: string }): Promise<AuthResult> {
      const result = await api.loginUser(input);
      if (result.ok) signedIn(result.user);
      return result;
    },

    async register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
      const result = await api.registerUser(input);
      if (result.ok) signedIn(result.user);
      return result;
    },

    async logout(): Promise<void> {
      // The server clears the cookie; local state is cleared even if the request fails.
      await api.logoutUser();
      setState({ status: 'unauthenticated', user: null, sessionExpired: false });
    },

    markSessionExpired(): void {
      if (state.status === 'authenticated' && !state.sessionExpired) {
        setState({ ...state, sessionExpired: true });
      }
    },
  };
}

export type AuthStore = ReturnType<typeof createAuthStore>;

export const authStore = createAuthStore();
