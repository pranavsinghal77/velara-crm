import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { unauthorized } from './httpError';

/**
 * Two-token scheme:
 *
 *  - Access token: short-lived JWT, returned in the response body and held in
 *    memory by the SPA. Sent as `Authorization: Bearer`. Never written to
 *    localStorage, so an XSS bug cannot lift a long-lived credential.
 *  - Refresh token: opaque random string in an httpOnly cookie. Only its
 *    SHA-256 hash is stored, and it is rotated (old row revoked) on every use,
 *    so a stolen refresh token is detectable and short-lived.
 */

export interface AccessTokenClaims {
  sub: string;
  orgId: string;
  role: Role;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: 'velara-crm',
    audience: 'velara-crm-api',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'velara-crm',
      audience: 'velara-crm-api',
    });
    if (typeof payload === 'string' || !payload.sub) {
      throw new Error('malformed payload');
    }
    return {
      sub: String(payload.sub),
      orgId: String((payload as jwt.JwtPayload).orgId),
      role: (payload as jwt.JwtPayload).role as Role,
    };
  } catch {
    throw unauthorized('Session expired or invalid');
  }
}

export const REFRESH_COOKIE = 'velara_rt';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function issueRefreshToken(
  userId: string,
  meta: { userAgent?: string; ip?: string }
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255),
      ip: meta.ip?.slice(0, 64),
    },
  });

  return { token, expiresAt };
}

/**
 * Consume a refresh token: verify it is live, revoke it, and return its owner.
 * Presenting an already-revoked token revokes that user's whole token family,
 * which turns a replayed (i.e. stolen) token into a forced re-login rather
 * than a silent second session.
 */
export async function rotateRefreshToken(token: string): Promise<string> {
  const tokenHash = hashToken(token);
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!row) throw unauthorized('Session not recognised');

  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized('Session reuse detected, please sign in again');
  }

  if (row.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Session expired');
  }

  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });

  return row.userId;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Housekeeping: drop rows that can no longer be used. */
export async function purgeExpiredTokens(): Promise<number> {
  const { count } = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

export function refreshCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true as const,
    secure: env.isProduction,
    // Lax keeps the cookie on top-level navigations while blocking it on
    // cross-site subrequests. The API itself authenticates with a Bearer
    // header, so no state-changing endpoint depends on this cookie.
    sameSite: env.isProduction ? ('none' as const) : ('lax' as const),
    path: '/api/auth',
    expires: expiresAt,
  };
}
