import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db';
import { forbidden, unauthorized } from '../utils/httpError';
import { logger } from '../utils/logger';

/**
 * Guards the cross-tenant platform console.
 *
 * `isPlatformAdmin` is deliberately not a tenant role. A customer's own Admin
 * has full authority inside their organisation and none at all outside it, so
 * the two cannot be conflated: if platform access were an ordinary role, any
 * tenant admin who could edit users could grant themselves a view of every
 * other customer. The flag is settable only by `npm run platform:grant`,
 * running against the database directly.
 *
 * Because these endpoints read across tenants, every call is logged with the
 * operator's identity.
 */
export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const ctx = req.auth;
  if (!ctx) return next(unauthorized());

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { id: true, email: true, isPlatformAdmin: true, isActive: true },
  });

  if (!user?.isActive || !user.isPlatformAdmin) {
    logger.warn('Platform console access denied', {
      userId: ctx.userId,
      orgId: ctx.orgId,
      path: req.originalUrl,
    });
    // 404 rather than 403: an ordinary tenant user should not learn that a
    // cross-tenant console exists at this path.
    return next(forbidden('Not found'));
  }

  logger.info('Platform console access', {
    operator: user.email,
    method: req.method,
    path: req.originalUrl,
  });

  res.setHeader('Cache-Control', 'no-store');
  next();
}
