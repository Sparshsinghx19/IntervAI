'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { onSessionExpired } from '@/lib/api-client';
import { authStore, INITIAL_AUTH_STATE } from '@/lib/auth-store';

/** Restores the current user once per page load and listens for expired sessions. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (authStore.getState().status === 'loading') {
      void authStore.restore();
    }
    return onSessionExpired(() => authStore.markSessionExpired());
  }, []);

  return <>{children}</>;
}

const getServerSnapshot = () => INITIAL_AUTH_STATE;

export function useAuth() {
  const state = useSyncExternalStore(authStore.subscribe, authStore.getState, getServerSnapshot);
  return {
    ...state,
    restore: authStore.restore,
    login: authStore.login,
    register: authStore.register,
    logout: authStore.logout,
  };
}
