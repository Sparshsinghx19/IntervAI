import type { ComponentType } from 'react';
import { CoachStaticFallback } from './CoachFallback';
import type { ThreeCoachProps } from './types';

/**
 * Loads the three.js coach chunk. If it can't be fetched (flaky network, a dev
 * server restarting, a stale tab after a deploy), retries once and then returns
 * the static coach instead of letting the error crash the page.
 */
export function loadCoachWithFallback(
  load: () => Promise<ComponentType<ThreeCoachProps>>,
  retryDelayMs = 1500
): Promise<ComponentType<ThreeCoachProps>> {
  return load().catch(() =>
    new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      .then(load)
      .catch(() => CoachStaticFallback as ComponentType<ThreeCoachProps>)
  );
}
