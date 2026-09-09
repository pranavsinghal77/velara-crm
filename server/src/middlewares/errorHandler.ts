import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';

/**
 * Single place where an error becomes a response. Deliberate `HttpError`s pass
 * their message through; everything else is reported as a generic 500 so
 * internal details (SQL, stack traces, file paths) never reach the client.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const mapped = mapError(err);

  const logMeta = {
    method: req.method,
    path: req.originalUrl,
    userId: req.auth?.userId,
    orgId: req.auth?.orgId,
  };

  if (mapped.status >= 500) {
    logger.error(`${mapped.status} ${mapped.message}`, {
      ...logMeta,
      stack: err instanceof Error ? err.stack : String(err),
    });
  } else {
    logger.warn(`${mapped.status} ${mapped.message}`, logMeta);
  }

  res.status(mapped.status).json({
    success: false,
    error: {
      code: mapped.code,
      message: mapped.message,
      ...(mapped.details ? { details: mapped.details } : {}),
      // Stacks are development-only, and gated on the validated env rather
      // than a raw string compare that a typo could silently disable.
      ...(!env.isProduction && err instanceof Error && mapped.status >= 500
        ? { stack: err.stack }
        : {}),
    },
  });
}

function mapError(err: unknown): {
  status: number;
  code: string;
  message: string;
  details?: unknown;
} {
  if (err instanceof HttpError) {
    return {
      status: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return {
          status: 409,
          code: 'conflict',
          message: `That ${fieldsOf(err) ?? 'value'} is already in use`,
        };
      case 'P2025':
        return { status: 404, code: 'not_found', message: 'Record not found' };
      case 'P2003':
        return {
          status: 400,
          code: 'bad_request',
          message: 'Referenced record does not exist',
        };
      default:
        return { status: 500, code: 'database_error', message: 'A database error occurred' };
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, code: 'bad_request', message: 'Malformed request data' };
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return { status: 400, code: 'bad_request', message: 'Request body is not valid JSON' };
  }

  return { status: 500, code: 'internal_error', message: 'Internal Server Error' };
}

function fieldsOf(err: Prisma.PrismaClientKnownRequestError): string | undefined {
  const target = (err.meta as { target?: string[] | string } | undefined)?.target;
  if (Array.isArray(target)) return target.join(', ');
  return typeof target === 'string' ? target : undefined;
}
