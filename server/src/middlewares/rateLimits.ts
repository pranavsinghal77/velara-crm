import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';

/**
 * Rate limits, tiered by how expensive and how abusable each surface is.
 * Authenticated traffic is keyed per user so one noisy tenant cannot exhaust
 * another's budget; unauthenticated traffic falls back to IP.
 */

const shared: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Skip limiting in tests so the suite is not order-dependent.
  skip: () => env.isTest,
  handler: (_req, _res, next) => {
    next(new HttpError(429, 'Too many requests, please slow down', 'rate_limited'));
  },
};

/** IPv6-safe key: the helper normalises addresses into a /56 subnet. */
const byUserOrIp = (req: Request) =>
  req.auth?.userId ?? ipKeyGenerator(req.ip ?? '0.0.0.0');

/** Broad backstop for the whole API. */
export const globalLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 300,
  keyGenerator: byUserOrIp,
});

/**
 * Credential endpoints. Tight, and keyed on IP + submitted email so guessing
 * many passwords for one account is throttled even from rotating addresses.
 */
export const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? '0.0.0.0')}:${email}`;
  },
});

/** Token refresh is called on every page load, so it gets more headroom. */
export const refreshLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 60,
});

/**
 * AI endpoints cost real money per call. This is the limit that stops an
 * unauthenticated third party from burning the Gemini quota - though the
 * primary defence is that these routes now require authentication at all.
 */
export const aiLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 20,
  keyGenerator: byUserOrIp,
});

/** Writes are cheaper than AI but still worth bounding. */
export const writeLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 120,
  keyGenerator: byUserOrIp,
});
