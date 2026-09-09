import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { badRequest } from '../utils/httpError';

/**
 * Validates and *replaces* the request part with the parsed result, so
 * controllers receive exactly the fields their schema declares and nothing
 * else. This is what closes the mass-assignment hole: an attacker can post
 * `role: "Admin"` all day, but it is stripped before Prisma ever sees it.
 *
 * (The previous version imported `AnyZodObject`, which no longer exists in
 * zod 4 - it would have thrown on import had anything actually used it.)
 */

type Part = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodType<T>, part: Part = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      return next(badRequest('Validation failed', formatIssues(result.error)));
    }

    // `query` and `params` are getter-backed in Express 5, so assign onto the
    // request under a dedicated key the controllers read instead.
    if (part === 'body') {
      req.body = result.data;
    } else {
      Object.defineProperty(req, part === 'query' ? 'validQuery' : 'validParams', {
        value: result.data,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  };
}

function formatIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/** Typed accessors for the non-body parts validated above. */
export function validatedQuery<T>(req: Request): T {
  return (req as Request & { validQuery: T }).validQuery;
}

export function validatedParams<T>(req: Request): T {
  return (req as Request & { validParams: T }).validParams;
}
