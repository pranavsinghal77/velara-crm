import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { Role, UsageKind } from '@prisma/client';
import { prisma } from '../config/db';
import { record } from '../billing/usage.service';
import { forbidden, unauthorized } from '../utils/httpError';

/**
 * API-key authentication, as an alternative to a user session.
 *
 * Keys are for machines: integrations, scripts, and MCP clients. They carry
 * explicit scopes rather than a role, because "what this key may do" is a
 * narrower question than "what this person may do".
 *
 * The stored value is a SHA-256 hash. SHA-256 rather than bcrypt is
 * deliberate here and is not the same trade-off as passwords: the key is 32
 * bytes of CSPRNG output, so there is no dictionary to attack, and a bcrypt
 * verification on every API call would dominate request latency. What matters
 * is that a database leak yields no usable keys, which a hash achieves.
 */

const KEY_PREFIX = 'vk_';
const PREFIX_VISIBLE_CHARS = 12;

export interface GeneratedKey {
  /** Shown once, never stored. */
  plaintext: string;
  prefix: string;
  keyHash: string;
}

export function generateApiKey(): GeneratedKey {
  const secret = crypto.randomBytes(32).toString('base64url');
  const plaintext = `${KEY_PREFIX}${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, PREFIX_VISIBLE_CHARS),
    keyHash: hashKey(plaintext),
  };
}

export function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

function presentedKey(req: Request): string | null {
  const header = req.get('x-api-key');
  if (header?.startsWith(KEY_PREFIX)) return header.trim();

  // Also accept `Authorization: Bearer vk_...`, which is what most MCP and
  // HTTP clients send by default.
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.startsWith(KEY_PREFIX)) return token;
  }

  return null;
}

/**
 * Authenticates a request presenting an API key and populates `req.auth` with
 * the same shape session auth produces, so controllers need no special case.
 * The synthetic role is Sales: a key can read and write records but can never
 * perform admin actions, which are reserved for a human session.
 */
export async function authenticateApiKey(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const presented = presentedKey(req);
  if (!presented) return next(unauthorized('Missing API key'));

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashKey(presented) },
    select: {
      id: true,
      orgId: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
      org: { select: { id: true } },
    },
  });

  if (!key) return next(unauthorized('Invalid API key'));
  if (key.revokedAt) return next(unauthorized('This API key has been revoked'));
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
    return next(unauthorized('This API key has expired'));
  }

  req.auth = {
    userId: `apikey:${key.id}`,
    orgId: key.orgId,
    role: Role.Sales,
    permissions: key.scopes,
  };
  req.apiKeyId = key.id;

  // Fire-and-forget: last-used tracking and metering must not add latency or
  // fail the request.
  void prisma.apiKey
    .update({
      where: { id: key.id },
      data: { lastUsedAt: new Date(), lastUsedIp: req.ip?.slice(0, 64) },
    })
    .catch(() => undefined);

  void record(
    { orgId: key.orgId, apiKeyId: key.id },
    UsageKind.api_request,
    { metadata: { method: req.method, path: req.path } }
  );

  next();
}

/** Requires a scope on the presenting key. Session users are unaffected. */
export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.apiKeyId) return next(); // session-authenticated; roles apply instead

    const scopes = req.auth?.permissions ?? [];
    if (scopes.includes('*') || scopes.includes(scope)) return next();

    next(forbidden(`This API key is missing the "${scope}" scope`));
  };
}

export const API_SCOPES = [
  'leads:read',
  'leads:write',
  'messages:read',
  'messages:write',
  'reminders:read',
  'reminders:write',
  'documents:read',
  'analytics:read',
  'ai:invoke',
] as const;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKeyId?: string;
    }
  }
}
