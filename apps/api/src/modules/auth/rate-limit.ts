import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  /** Builds the bucket key; return null to skip limiting for this request. */
  key: (req: Request) => string | null;
  /** Hard cap on tracked keys so memory stays bounded under key-spraying. */
  maxKeys?: number;
  now?: () => number;
}

/**
 * Small fixed-window, in-memory limiter for the auth endpoints. Process-local:
 * a multi-instance deployment needs a shared store instead.
 */
export const createRateLimiter = (options: RateLimiterOptions) => {
  const { windowMs, max, key } = options;
  const maxKeys = options.maxKeys ?? 10_000;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  const prune = (at: number) => {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= at) buckets.delete(k);
    }
    // Still full of live windows: drop the oldest entries (Map keeps insertion order).
    while (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  };

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const bucketKey = key(req);
    if (bucketKey === null) return next();

    const at = now();
    let bucket = buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= at) {
      if (!bucket && buckets.size >= maxKeys) prune(at);
      bucket = { count: 0, resetAt: at + windowMs };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - at) / 1000))));
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    }
    return next();
  };

  return Object.assign(middleware, {
    reset: () => buckets.clear(),
    size: () => buckets.size,
  });
};

export const clientIp = (req: Request): string => req.ip || req.socket?.remoteAddress || 'unknown';
