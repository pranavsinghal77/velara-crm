import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import type { ChangePasswordInput, LoginInput } from '../schemas';
import { forbidden, unauthorized } from '../utils/httpError';
import { equaliseTiming, hashPassword, verifyPassword } from '../utils/password';
import { serializeUser } from '../utils/serializers';
import {
  REFRESH_COOKIE,
  issueRefreshToken,
  refreshCookieOptions,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from '../utils/tokens';

function requestMeta(req: Request) {
  return { userAgent: req.get('user-agent') ?? undefined, ip: req.ip };
}

async function establishSession(req: Request, res: Response, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!user.isActive) throw forbidden('This account has been deactivated');

  const { token, expiresAt } = await issueRefreshToken(user.id, requestMeta(req));
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(expiresAt));

  return {
    accessToken: signAccessToken({ sub: user.id, orgId: user.orgId, role: user.role }),
    user: serializeUser(user),
  };
}

/**
 * POST /api/auth/login
 *
 * The old implementation had two bypasses: a literal `'redacted'` password
 * that accepted anything, and a `password &&` guard that let a request with no
 * password through entirely. Both are gone - the only way in is a bcrypt match
 * against a stored hash.
 */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Spend the same time as a real comparison so timing does not reveal
    // whether the address exists.
    await equaliseTiming(password);
    throw unauthorized('Invalid email or password');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid email or password');
  if (!user.isActive) throw forbidden('This account has been deactivated');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  res.json(await establishSession(req, res, user.id));
}

/**
 * POST /api/auth/refresh
 *
 * Exchanges the httpOnly refresh cookie for a new access token, rotating the
 * refresh token in the process.
 */
export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== 'string' || !token) throw unauthorized('No session cookie');

  const userId = await rotateRefreshToken(token);
  res.json(await establishSession(req, res, userId));
}

/** POST /api/auth/logout */
export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token === 'string' && token) {
    await revokeRefreshToken(token);
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).end();
}

/** GET /api/auth/me */
export async function me(req: Request, res: Response) {
  const { userId } = auth(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: user.orgId },
    select: { id: true, name: true, slug: true },
  });
  res.json({ user: serializeUser(user), organization: org });
}

/**
 * POST /api/auth/change-password
 *
 * Revokes every other session on success, so a password change actually
 * evicts an attacker who already had one.
 */
export async function changePassword(req: Request, res: Response) {
  const { userId } = auth(req);
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw unauthorized('Current password is incorrect');

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await revokeAllForUser(userId);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });

  res.json({ success: true, message: 'Password updated. Please sign in again.' });
}
