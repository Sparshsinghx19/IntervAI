import type { NextFunction, Request, Response } from 'express';
import { db } from '../../prisma/db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const interviewAccess = {
  /**
   * True only when the interview exists AND belongs to the user. Legacy rows
   * with no owner never match, because NULL is never equal to a user id.
   */
  isOwnedBy: async (interviewId: string, userId: string): Promise<boolean> => {
    const row = await db.orm.public.Interview.where({ id: interviewId, ownerId: userId }).select('id').first();
    return Boolean(row);
  },
};

/**
 * Route guard for any route addressing an interview by id. Must run after
 * `requireAuth`. Missing and foreign interviews get the same 404 so ids of other
 * users' interviews cannot be probed.
 */
export const requireInterviewOwnership = (paramName: string) => {
  const guard = async (req: Request, res: Response, next: NextFunction) => {
    const principal = req.principal;
    if (!principal) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const raw = req.params[paramName];
    const interviewId = Array.isArray(raw) ? raw[0] : raw;
    if (!interviewId || !UUID_REGEX.test(interviewId)) {
      return res.status(400).json({ error: 'Invalid interview ID format' });
    }

    try {
      if (!(await interviewAccess.isOwnedBy(interviewId, principal.userId))) {
        return res.status(404).json({ error: 'Interview not found' });
      }
      return next();
    } catch (err: any) {
      console.error('[Auth] Interview ownership check failed:', err?.name || 'Error');
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
  // Lets tests assert that every interview route carries this guard.
  return Object.assign(guard, { ownershipParam: paramName });
};
