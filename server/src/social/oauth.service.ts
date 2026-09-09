import crypto from 'crypto';
import { SocialPlatform, SocialConnectionStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { decrypt, encrypt } from '../utils/encryption';
import { badRequest, serviceUnavailable, unauthorized } from '../utils/httpError';
import { logger } from '../utils/logger';
import { GRAPH_BASE, isConfigured, missingEnv, providerFor, redirectUri } from './providers';

/**
 * OAuth 2.0 authorization-code flow, shared across the platforms.
 *
 * Two things this does that a naive implementation skips:
 *
 *  - `state` is a random value persisted server-side against the tenant and
 *    user who started the flow, single-use and short-lived. Without it, a
 *    callback cannot be trusted to belong to the session that began it, and an
 *    attacker can complete their own authorisation into someone else's
 *    workspace.
 *  - PKCE for providers that require it (X), so an intercepted code cannot be
 *    redeemed without the verifier.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: unknown;
  error_description?: string;
}

function assertConfigured(platform: SocialPlatform) {
  if (!isConfigured(platform)) {
    const missing = missingEnv(platform).join(', ');
    throw serviceUnavailable(
      `${providerFor(platform).label} is not configured on this server. Missing: ${missing}.`
    );
  }
}

/** Builds the provider consent URL and records the state that ties it back. */
export async function beginAuthorization(params: {
  platform: SocialPlatform;
  orgId: string;
  userId: string;
  redirectTo?: string;
}): Promise<string> {
  const { platform, orgId, userId, redirectTo } = params;
  assertConfigured(platform);

  const provider = providerFor(platform);
  const state = crypto.randomBytes(32).toString('base64url');

  let codeVerifier: string | null = null;
  let codeChallenge: string | null = null;

  if (provider.usesPkce) {
    codeVerifier = crypto.randomBytes(48).toString('base64url');
    codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  await prisma.socialOAuthState.create({
    data: {
      state,
      orgId,
      userId,
      platform,
      codeVerifier,
      redirectTo: redirectTo ?? null,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
  });

  const url = new URL(provider.authorizeUrl);
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('redirect_uri', redirectUri(platform));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', provider.scopes.join(platform === SocialPlatform.x ? ' ' : ','));
  url.searchParams.set('state', state);

  if (codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  return url.toString();
}

/** Validates and consumes a state value from a callback. */
export async function consumeState(state: string) {
  const row = await prisma.socialOAuthState.findUnique({ where: { state } });

  if (!row) throw unauthorized('Unrecognised authorisation request');
  if (row.consumedAt) throw unauthorized('This authorisation link has already been used');
  if (row.expiresAt.getTime() < Date.now()) {
    throw unauthorized('This authorisation request expired. Please start again.');
  }

  await prisma.socialOAuthState.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  return row;
}

/** Exchanges the authorization code for tokens. */
export async function exchangeCode(params: {
  platform: SocialPlatform;
  code: string;
  codeVerifier?: string | null;
}): Promise<TokenResponse> {
  const { platform, code, codeVerifier } = params;
  const provider = providerFor(platform);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(platform),
    client_id: provider.clientId,
  });

  if (codeVerifier) body.set('code_verifier', codeVerifier);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  // X authenticates the client with Basic auth on the token endpoint; Meta and
  // LinkedIn take the secret as a body parameter.
  if (platform === SocialPlatform.x) {
    headers.Authorization = `Basic ${Buffer.from(
      `${provider.clientId}:${provider.clientSecret}`
    ).toString('base64')}`;
  } else {
    body.set('client_secret', provider.clientSecret);
  }

  return postForm(provider.tokenUrl, body, headers, `${provider.label} token exchange`);
}

/** Refreshes an access token where the provider supports it. */
export async function refreshAccessToken(connectionId: string): Promise<void> {
  const conn = await prisma.socialConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const provider = providerFor(conn.platform);

  if (!provider.supportsRefresh || !conn.refreshTokenEnc) {
    await markExpired(connectionId, 'This platform requires reconnecting rather than refreshing.');
    throw unauthorized(`${provider.label} needs to be reconnected.`);
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: decrypt(conn.refreshTokenEnc),
    client_id: provider.clientId,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  if (conn.platform === SocialPlatform.x) {
    headers.Authorization = `Basic ${Buffer.from(
      `${provider.clientId}:${provider.clientSecret}`
    ).toString('base64')}`;
  } else {
    body.set('client_secret', provider.clientSecret);
  }

  try {
    const tokens = await postForm(
      provider.tokenUrl,
      body,
      headers,
      `${provider.label} token refresh`
    );

    await prisma.socialConnection.update({
      where: { id: connectionId },
      data: {
        accessTokenEnc: encrypt(tokens.access_token),
        // Rotating providers return a new refresh token; keep the old one when
        // they do not, or the connection becomes unrefreshable.
        ...(tokens.refresh_token ? { refreshTokenEnc: encrypt(tokens.refresh_token) } : {}),
        expiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
        status: SocialConnectionStatus.Connected,
        statusDetail: null,
      },
    });
  } catch (err) {
    await markExpired(
      connectionId,
      err instanceof Error ? err.message : 'Token refresh failed.'
    );
    throw err;
  }
}

/**
 * Returns a usable access token, refreshing first if it is expired or about to
 * be. The 60-second skew avoids handing out a token that dies mid-request.
 */
export async function usableAccessToken(connectionId: string): Promise<string> {
  let conn = await prisma.socialConnection.findUniqueOrThrow({ where: { id: connectionId } });

  if (conn.status === SocialConnectionStatus.Revoked) {
    throw unauthorized(
      `${providerFor(conn.platform).label} access was revoked. Reconnect the account.`
    );
  }

  if (conn.expiresAt && conn.expiresAt.getTime() - 60_000 < Date.now()) {
    await refreshAccessToken(connectionId);
    conn = await prisma.socialConnection.findUniqueOrThrow({ where: { id: connectionId } });
  }

  return decrypt(conn.accessTokenEnc);
}

async function markExpired(connectionId: string, detail: string) {
  await prisma.socialConnection.update({
    where: { id: connectionId },
    data: { status: SocialConnectionStatus.Expired, statusDetail: detail },
  });
}

/**
 * Meta issues a short-lived user token; publishing needs a long-lived page
 * token instead. Skipping this is why naive integrations break after an hour.
 */
export async function exchangeForLongLivedMetaToken(shortLived: string): Promise<TokenResponse> {
  const provider = providerFor(SocialPlatform.facebook);
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('client_secret', provider.clientSecret);
  url.searchParams.set('fb_exchange_token', shortLived);

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const payload = (await res.json().catch(() => null)) as TokenResponse | null;

  if (!res.ok || !payload?.access_token) {
    throw badRequest(
      payload?.error_description ?? 'Meta refused to issue a long-lived token.'
    );
  }
  return payload;
}

async function postForm(
  url: string,
  body: URLSearchParams,
  headers: Record<string, string>,
  label: string
): Promise<TokenResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => null)) as TokenResponse | null;

    if (!res.ok || !payload?.access_token) {
      const detail =
        payload?.error_description ??
        (typeof payload?.error === 'string' ? payload.error : undefined) ??
        `HTTP ${res.status}`;
      // Never log the body: it carries codes and tokens.
      logger.warn(`${label} failed`, { status: res.status });
      throw badRequest(`${label} failed: ${detail}`);
    }

    return payload;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw serviceUnavailable(`${label} timed out.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Housekeeping: consumed and expired state rows accumulate otherwise. */
export async function purgeOAuthStates(): Promise<number> {
  const { count } = await prisma.socialOAuthState.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } },
  });
  return count;
}

export const appUrl = () => env.PUBLIC_APP_URL.replace(/\/+$/, '');
