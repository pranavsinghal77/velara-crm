import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/db';
import { forbidden, unauthorized } from '../utils/httpError';
import { verifyAccessToken } from '../utils/tokens';

/**
 * Authenticated request context. Controllers read `req.auth.orgId` rather than
 * trusting any org/user id from the request body, which is what makes
 * cross-tenant access structurally impossible instead of merely unlikely.
 */
export interface AuthContext {
  userId: string;
  orgId: string;
  role: Role;
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies the access token, then confirms the account is still live. The
 * database check means deactivating a user takes effect immediately rather
 * than whenever their token happens to expire.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) return next(unauthorized('Missing bearer token'));

  const claims = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, orgId: true, role: true, isActive: true, permissions: true },
  });

  if (!user) return next(unauthorized('Account no longer exists'));
  if (!user.isActive) return next(forbidden('This account has been deactivated'));
  // A token minted before the user was moved between orgs must not keep
  // granting access to the old one.
  if (user.orgId !== claims.orgId) return next(unauthorized('Session no longer valid'));

  req.auth = {
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    permissions: user.permissions,
  };

  next();
}

/** Guaranteed-present auth context, for use inside guarded handlers. */
export function auth(req: Request): AuthContext {
  if (!req.auth) {
    // Programmer error: a controller was mounted without requireAuth.
    throw unauthorized();
  }
  return req.auth;
}

const ROLE_RANK: Record<Role, number> = {
  [Role.Viewer]: 0,
  [Role.Sales]: 1,
  [Role.Manager]: 2,
  [Role.Admin]: 3,
};

/** Require at least the given role. Admin therefore satisfies every check. */
export function requireRole(minimum: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const ctx = req.auth;
    if (!ctx) return next(unauthorized());
    if (ROLE_RANK[ctx.role] < ROLE_RANK[minimum]) {
      return next(forbidden(`Requires ${minimum} access or above`));
    }
    next();
  };
}

/** Anything that mutates data requires more than a Viewer seat. */
export const requireWriter = requireRole(Role.Sales);
export const requireManager = requireRole(Role.Manager);
export const requireAdmin = requireRole(Role.Admin);
