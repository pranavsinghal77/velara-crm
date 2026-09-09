import crypto from 'crypto';
import { MicrosoftConnectionStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { decrypt, encrypt } from '../utils/encryption';
import { badRequest, serviceUnavailable, unauthorized } from '../utils/httpError';

/**
 * Microsoft 365 via Microsoft Graph: Outlook mail, Teams meetings, calendar.
 *
 * The whole feature rests on one OAuth connection per user. The token dance
 * lives here alongside the Graph calls, and — as with the Apollo and social
 * integrations — the parts that decide *what a request should contain* are
 * pulled out as pure functions and unit-tested, because that is where a wrong
 * timezone or a malformed recipient does real damage rather than throwing
 * loudly.
 *
 * Registering the Azure app is unavoidably a human step (a client id/secret
 * against a named redirect URI, with the delegated scopes consented). The code
 * is complete; it activates the moment MS_CLIENT_ID / MS_CLIENT_SECRET are set.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const STATE_TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 20_000;

/** Delegated scopes. `offline_access` is what makes a refresh token possible. */
export const MS_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Mail.Send',
  'Calendars.ReadWrite',
  'OnlineMeetings.ReadWrite',
];

export function isConfigured(): boolean {
  return env.MS_CLIENT_ID.length > 0 && env.MS_CLIENT_SECRET.length > 0;
}

export function missingEnv(): string[] {
  const missing: string[] = [];
  if (!env.MS_CLIENT_ID) missing.push('MS_CLIENT_ID');
  if (!env.MS_CLIENT_SECRET) missing.push('MS_CLIENT_SECRET');
  return missing;
}

function assertConfigured() {
  if (!isConfigured()) {
    throw serviceUnavailable(
      `Microsoft 365 is not configured on this server. Missing: ${missingEnv().join(', ')}.`
    );
  }
}

/** Derived from configuration, not the request, so it matches the Azure app. */
export function redirectUri(): string {
  return `${env.PUBLIC_API_URL.replace(/\/+$/, '')}/api/microsoft/callback`;
}

const authority = () => `https://login.microsoftonline.com/${env.MS_TENANT}`;

// ── OAuth ──

export interface MsTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/** Builds the consent URL and records the state (with PKCE verifier) behind it. */
export async function beginAuthorization(params: {
  orgId: string;
  userId: string;
  redirectTo?: string;
}): Promise<string> {
  assertConfigured();

  const state = crypto.randomBytes(32).toString('base64url');
  const codeVerifier = crypto.randomBytes(48).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  await prisma.microsoftOAuthState.create({
    data: {
      state,
      orgId: params.orgId,
      userId: params.userId,
      codeVerifier,
      redirectTo: params.redirectTo ?? null,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
  });

  const url = new URL(`${authority()}/oauth2/v2.0/authorize`);
  url.searchParams.set('client_id', env.MS_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', MS_SCOPES.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // Ensures a refresh token even for an account that consented before.
  url.searchParams.set('prompt', 'select_account');

  return url.toString();
}

export async function consumeState(state: string) {
  const row = await prisma.microsoftOAuthState.findUnique({ where: { state } });
  if (!row) throw unauthorized('Unrecognised authorisation request.');
  if (row.consumedAt) throw unauthorized('This authorisation link has already been used.');
  if (row.expiresAt.getTime() < Date.now()) {
    throw unauthorized('This authorisation request expired. Please start again.');
  }
  await prisma.microsoftOAuthState.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return row;
}

async function postToken(body: URLSearchParams): Promise<MsTokenResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as MsTokenResponse | null;
    if (!res.ok || !data?.access_token) {
      throw badRequest(
        data?.error_description ?? data?.error ?? `Microsoft token endpoint returned HTTP ${res.status}.`
      );
    }
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw serviceUnavailable('Microsoft did not respond in time.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<MsTokenResponse> {
  return postToken(
    new URLSearchParams({
      client_id: env.MS_CLIENT_ID,
      client_secret: env.MS_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: codeVerifier,
      scope: MS_SCOPES.join(' '),
    })
  );
}

async function refreshAccessToken(connectionId: string): Promise<void> {
  const conn = await prisma.microsoftConnection.findUniqueOrThrow({ where: { id: connectionId } });
  if (!conn.refreshTokenEnc) {
    await markExpired(connectionId, 'No refresh token stored; the account must be reconnected.');
    throw unauthorized('Microsoft 365 needs to be reconnected.');
  }

  try {
    const tokens = await postToken(
      new URLSearchParams({
        client_id: env.MS_CLIENT_ID,
        client_secret: env.MS_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: decrypt(conn.refreshTokenEnc),
        scope: MS_SCOPES.join(' '),
      })
    );
    await prisma.microsoftConnection.update({
      where: { id: connectionId },
      data: {
        accessTokenEnc: encrypt(tokens.access_token),
        // Microsoft rotates refresh tokens; keep the old one only if none came back.
        ...(tokens.refresh_token ? { refreshTokenEnc: encrypt(tokens.refresh_token) } : {}),
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        status: MicrosoftConnectionStatus.Connected,
        statusDetail: null,
      },
    });
  } catch (err) {
    await markExpired(connectionId, err instanceof Error ? err.message : 'Token refresh failed.');
    throw err;
  }
}

/** A usable access token, refreshed if it is expired or within 60s of it. */
export async function usableAccessToken(connectionId: string): Promise<string> {
  let conn = await prisma.microsoftConnection.findUniqueOrThrow({ where: { id: connectionId } });
  if (conn.status === MicrosoftConnectionStatus.Revoked) {
    throw unauthorized('Microsoft 365 access was revoked. Reconnect the account.');
  }
  if (conn.expiresAt && conn.expiresAt.getTime() - 60_000 < Date.now()) {
    await refreshAccessToken(connectionId);
    conn = await prisma.microsoftConnection.findUniqueOrThrow({ where: { id: connectionId } });
  }
  return decrypt(conn.accessTokenEnc);
}

async function markExpired(connectionId: string, detail: string) {
  await prisma.microsoftConnection
    .update({
      where: { id: connectionId },
      data: { status: MicrosoftConnectionStatus.Expired, statusDetail: detail },
    })
    .catch(() => {});
}

// ── Graph calls ──

interface GraphError extends Error {
  status?: number;
}

function graphError(status: number, message: string): GraphError {
  const err = new Error(message) as GraphError;
  err.status = status;
  return err;
}

async function graph<T>(
  connectionId: string,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: T | null }> {
  const token = await usableAccessToken(connectionId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    // 202 (sendMail) and 204 (delete) carry no body.
    const text = await res.text();
    const data = text ? (JSON.parse(text) as T & { error?: { code?: string; message?: string } }) : null;

    if (!res.ok) {
      const g = data as { error?: { message?: string } } | null;
      const message =
        g?.error?.message ??
        (res.status === 401
          ? 'Microsoft rejected the request; the connection may need reconnecting.'
          : res.status === 403
            ? 'This Microsoft account has not granted the permission this action needs.'
            : res.status === 429
              ? 'Microsoft rate limit reached. Try again shortly.'
              : `Microsoft Graph returned HTTP ${res.status}.`);
      // An auth failure marks the connection so the UI prompts a reconnect.
      if (res.status === 401) await markExpired(connectionId, message);
      throw graphError(res.status, message);
    }

    await prisma.microsoftConnection
      .update({ where: { id: connectionId }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return { status: res.status, data };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw graphError(504, 'Microsoft Graph did not respond in time.');
    }
    if (err instanceof TypeError) {
      throw graphError(502, 'Could not reach Microsoft Graph (network error).');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** The connected account's profile, read once at connect time. */
export async function fetchProfile(
  accessToken: string
): Promise<{ id: string; email: string; displayName?: string }> {
  const res = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => null)) as
    | { id?: string; mail?: string; userPrincipalName?: string; displayName?: string }
    | null;
  if (!res.ok || !data?.id) {
    throw badRequest('Could not read the Microsoft profile after connecting.');
  }
  return {
    id: data.id,
    email: data.mail ?? data.userPrincipalName ?? 'unknown',
    displayName: data.displayName,
  };
}

// ── Pure payload builders (unit-tested) ──

export interface MailInput {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  /** Text is the safe default; callers opt into HTML explicitly. */
  html?: boolean;
}

export function buildMailPayload(input: MailInput): Record<string, unknown> {
  const recipients = (addresses: string[]) =>
    addresses.map((address) => ({ emailAddress: { address } }));

  return {
    message: {
      subject: input.subject,
      body: { contentType: input.html ? 'HTML' : 'Text', content: input.body },
      toRecipients: recipients(input.to),
      ...(input.cc?.length ? { ccRecipients: recipients(input.cc) } : {}),
    },
    // A sent email the sender cannot find in Sent Items looks like it never went.
    saveToSentItems: true,
  };
}

export interface MeetingInput {
  subject: string;
  body?: string;
  /** ISO-8601 local date-times, interpreted in `timeZone`. */
  start: string;
  end: string;
  timeZone: string;
  attendees?: { email: string; name?: string }[];
  /** Attach a Teams online meeting with a join link. */
  teams?: boolean;
}

export function buildEventPayload(input: MeetingInput): Record<string, unknown> {
  return {
    subject: input.subject,
    ...(input.body ? { body: { contentType: 'HTML', content: input.body } } : {}),
    start: { dateTime: input.start, timeZone: input.timeZone },
    end: { dateTime: input.end, timeZone: input.timeZone },
    ...(input.attendees?.length
      ? {
          attendees: input.attendees.map((a) => ({
            emailAddress: { address: a.email, name: a.name },
            type: 'required',
          })),
        }
      : {}),
    ...(input.teams ? { isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness' } : {}),
  };
}

export interface GraphEvent {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  isAllDay?: boolean;
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl?: string } | null;
  webLink?: string;
  location?: { displayName?: string };
  attendees?: { emailAddress?: { address?: string; name?: string } }[];
  organizer?: { emailAddress?: { address?: string; name?: string } };
}

/** A Graph event, flattened to the shape the CRM renders. */
export function mapEvent(event: GraphEvent) {
  return {
    id: event.id,
    subject: event.subject ?? '(no subject)',
    preview: event.bodyPreview ?? '',
    start: event.start?.dateTime ?? null,
    end: event.end?.dateTime ?? null,
    timeZone: event.start?.timeZone ?? null,
    isAllDay: Boolean(event.isAllDay),
    isTeams: Boolean(event.isOnlineMeeting),
    joinUrl: event.onlineMeeting?.joinUrl ?? null,
    webLink: event.webLink ?? null,
    location: event.location?.displayName ?? null,
    attendees: (event.attendees ?? [])
      .map((a) => a.emailAddress?.address)
      .filter((a): a is string => Boolean(a)),
    organizer: event.organizer?.emailAddress?.address ?? null,
  };
}

// ── Feature operations ──

export async function sendMail(connectionId: string, input: MailInput): Promise<void> {
  await graph(connectionId, 'POST', '/me/sendMail', buildMailPayload(input));
}

export async function createEvent(connectionId: string, input: MeetingInput) {
  const { data } = await graph<GraphEvent>(connectionId, 'POST', '/me/events', buildEventPayload(input));
  if (!data) throw graphError(502, 'Microsoft created the event but returned nothing to link to.');
  return mapEvent(data);
}

export async function listCalendar(
  connectionId: string,
  fromIso: string,
  toIso: string,
  timeZone: string
) {
  const params = new URLSearchParams({
    startDateTime: fromIso,
    endDateTime: toIso,
    $orderby: 'start/dateTime',
    $top: '100',
  });
  const { data } = await graph<{ value?: GraphEvent[] }>(
    connectionId,
    'GET',
    `/me/calendarView?${params.toString()}`,
    undefined,
    // Ask Graph to return times already in the org timezone.
    { Prefer: `outlook.timezone="${timeZone}"` }
  );
  return (data?.value ?? []).map(mapEvent);
}

export async function cancelEvent(connectionId: string, eventId: string): Promise<void> {
  // DELETE removes the event and, for a meeting the user organises, sends the
  // attendees a cancellation — which is the behaviour a CRM "cancel" should have.
  await graph(connectionId, 'DELETE', `/me/events/${encodeURIComponent(eventId)}`);
}

export async function purgeMicrosoftStates(): Promise<number> {
  const { count } = await prisma.microsoftOAuthState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
