import type { Temporal as TemporalTypes } from 'temporal-polyfill';

/** Timestamp type the ORM reads and writes for `DateTime` columns. */
export type Instant = TemporalTypes.Instant;

// prisma/db.ts installs the Temporal polyfill globally at startup. Types are
// imported locally so the rest of the codebase keeps its current typing.
const temporal = (): typeof TemporalTypes =>
  (globalThis as unknown as { Temporal: typeof TemporalTypes }).Temporal;

export const nowInstant = (): Instant => temporal().Now.instant();

export const instantFromMs = (ms: number): Instant => temporal().Instant.fromEpochMilliseconds(ms);
