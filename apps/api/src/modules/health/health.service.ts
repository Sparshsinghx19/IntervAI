import { db } from '../../prisma/db.js';
import { codeExecutionEnabled } from '../coding/coding-problems.catalog.js';

export const healthService = {
  checkHealth: () => {
    return { status: 'ok' };
  },

  /** Readiness for hosting platforms: can the API reach its database? Reports no connection details. */
  checkReady: async (query: () => Promise<unknown> = async () => { await db.runtime().query(db.sql.public.user.select('id').limit(1).build()); }) => {
    let database: 'ok' | 'unavailable' = 'ok';
    try {
      await query();
    } catch {
      database = 'unavailable';
    }
    return { status: database === 'ok' ? 'ok' : 'degraded', database, codeExecution: codeExecutionEnabled() ? 'enabled' : 'disabled' };
  },
};
