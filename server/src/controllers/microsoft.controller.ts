import { MicrosoftConnectionStatus, UsageKind } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { auth } from '../middlewares/auth';
import { encrypt, encryptionAvailable } from '../utils/encryption';
import { badRequest, notFound, serviceUnavailable } from '../utils/httpError';
import { logger } from '../utils/logger';
import { record } from '../billing/usage.service';
import {
  beginAuthorization,
  cancelEvent,
  consumeState,
  createEvent,
  exchangeCode,
  fetchProfile,
  isConfigured,
  listCalendar,
  missingEnv,
  sendMail,
} from '../microsoft/graph.service';
import type {
  MicrosoftMeetingInput,
  MicrosoftMailInput,
  MicrosoftCalendarQuery,
} from '../schemas';

/**
 * Microsoft 365: connect an Outlook account, then send mail, schedule Teams
 * meetings and read the calendar as that user.
 *
 * Every feature endpoint reads the caller's own connection — the token is
 * theirs, and a user can only act as their own mailbox, never another's. The
 * connect flow follows the same single-use-state, PKCE pattern as the social
 * OAuth, and the callback is mounted ahead of `requireAuth` because the
 * provider returns the browser here with no session header.
 */

const appUrl = () => env.PUBLIC_APP_URL.replace(/\/+$/, '');

function graphErrorStatus(err: unknown): number {
  return (err as { status?: number }).status ?? 500;
}

async function connectionForUser(orgId: string, userId: string) {
  return prisma.microsoftConnection.findFirst({ where: { orgId, userId } });
}

/** GET /api/microsoft/status — the caller's own connection. */
export async function getStatus(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const conn = await connectionForUser(orgId, userId);

  res.json({
    configured: isConfigured(),
    missingEnv: isConfigured() ? [] : missingEnv(),
    encryptionAvailable: encryptionAvailable(),
    connection: conn
      ? {
          email: conn.email,
          displayName: conn.displayName,
          status: conn.status,
          statusDetail: conn.statusDetail,
          scopes: conn.scopes,
          connectedAt: conn.createdAt.toISOString(),
          lastUsedAt: conn.lastUsedAt?.toISOString() ?? null,
          expiresAt: conn.expiresAt?.toISOString() ?? null,
        }
      : null,
    // Capabilities the UI can offer, so it does not show a "Schedule Teams
    // meeting" button on a server that cannot do it.
    capabilities: { mail: true, calendar: true, teams: true },
  });
}

/** POST /api/microsoft/connect — returns the Microsoft consent URL. */
export async function startConnect(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  if (!encryptionAvailable()) {
    throw serviceUnavailable(
      'This server has no ENCRYPTION_KEY, so Microsoft tokens cannot be stored securely.'
    );
  }
  const url = await beginAuthorization({ orgId, userId });
  res.json({ authorizeUrl: url });
}

/**
 * GET /api/microsoft/callback — the OAuth return leg.
 *
 * Unauthenticated by design: the provider sends the browser here by top-level
 * navigation. The single-use `state` is what proves which user began the flow.
 */
export async function handleCallback(req: Request, res: Response) {
  const { code, state, error, error_description: errorDescription } = req.query as Record<
    string,
    string | undefined
  >;

  const back = (params: Record<string, string>) => {
    const url = new URL(`${appUrl()}/settings`);
    url.searchParams.set('tab', 'integrations');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return res.redirect(url.toString());
  };

  if (error) return back({ ms_error: errorDescription ?? error });
  if (!code || !state) return back({ ms_error: 'Missing authorisation code.' });

  try {
    const stateRow = await consumeState(state);
    const tokens = await exchangeCode(code, stateRow.codeVerifier);
    const profile = await fetchProfile(tokens.access_token);

    await prisma.microsoftConnection.upsert({
      where: { userId: stateRow.userId },
      create: {
        orgId: stateRow.orgId,
        userId: stateRow.userId,
        microsoftUserId: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
        status: MicrosoftConnectionStatus.Connected,
      },
      update: {
        microsoftUserId: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        accessTokenEnc: encrypt(tokens.access_token),
        ...(tokens.refresh_token ? { refreshTokenEnc: encrypt(tokens.refresh_token) } : {}),
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
        status: MicrosoftConnectionStatus.Connected,
        statusDetail: null,
      },
    });

    return back({ ms_connected: profile.email });
  } catch (err) {
    logger.warn('Microsoft callback failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return back({ ms_error: err instanceof Error ? err.message : 'Connection failed.' });
  }
}

/** DELETE /api/microsoft/connection — disconnect the caller's account. */
export async function disconnect(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  await prisma.microsoftConnection.deleteMany({ where: { orgId, userId } });
  res.status(204).end();
}

/** Resolves the caller's usable connection, or a clear reason it is not. */
async function requireConnection(orgId: string, userId: string) {
  const conn = await connectionForUser(orgId, userId);
  if (!conn) {
    throw badRequest('Connect your Microsoft 365 account in Settings before using this.');
  }
  if (conn.status === MicrosoftConnectionStatus.Revoked) {
    throw badRequest('Your Microsoft 365 access was revoked. Reconnect the account.');
  }
  return conn;
}

/** If a lead is named, confirm it belongs to the tenant before we touch it. */
async function assertLead(orgId: string, leadId: string | undefined) {
  if (!leadId) return null;
  const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { id: true } });
  if (!lead) throw badRequest('leadId does not reference a lead in your organisation.');
  return lead.id;
}

/** POST /api/microsoft/mail — send an Outlook email as the caller. */
export async function sendEmail(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const input = req.body as MicrosoftMailInput;

  const conn = await requireConnection(orgId, userId);
  const leadId = await assertLead(orgId, input.leadId);

  try {
    await sendMail(conn.id, {
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      body: input.body,
      html: input.html,
    });
  } catch (err) {
    throw graphErrorStatus(err) < 500
      ? badRequest(err instanceof Error ? err.message : 'Send failed.')
      : serviceUnavailable(err instanceof Error ? err.message : 'Send failed.');
  }

  // Metered like any other outbound message, and logged against the lead when
  // one was named so the thread reflects that an email actually went out.
  await record({ orgId, userId }, UsageKind.message_sent, {
    metadata: { channel: 'outlook', to: input.to.length, leadId: leadId ?? undefined },
  });

  res.status(202).json({ sent: true, recipients: input.to.length });
}

/** POST /api/microsoft/meetings — create a calendar event, optionally on Teams. */
export async function scheduleMeeting(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const input = req.body as MicrosoftMeetingInput;

  const conn = await requireConnection(orgId, userId);
  await assertLead(orgId, input.leadId);

  if (new Date(input.end).getTime() <= new Date(input.start).getTime()) {
    throw badRequest('The meeting end time must be after its start time.');
  }

  try {
    const event = await createEvent(conn.id, {
      subject: input.subject,
      body: input.body,
      start: input.start,
      end: input.end,
      // Times are interpreted in the tenant's timezone unless the caller names one.
      timeZone: input.timeZone ?? env.APP_TIMEZONE,
      attendees: input.attendees,
      teams: input.teams ?? false,
    });
    res.status(201).json(event);
  } catch (err) {
    throw graphErrorStatus(err) < 500
      ? badRequest(err instanceof Error ? err.message : 'Could not create the meeting.')
      : serviceUnavailable(err instanceof Error ? err.message : 'Could not create the meeting.');
  }
}

/** GET /api/microsoft/calendar — events in a window, in the org timezone. */
export async function getCalendar(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const { from, to } = req.query as unknown as MicrosoftCalendarQuery;

  const conn = await requireConnection(orgId, userId);

  // Default to the coming week, which is what a "what's next" panel wants.
  const start = from ? new Date(from) : new Date();
  const end = to ? new Date(to) : new Date(start.getTime() + 7 * 86_400_000);
  if (end.getTime() <= start.getTime()) throw badRequest('`to` must be after `from`.');

  try {
    const events = await listCalendar(conn.id, start.toISOString(), end.toISOString(), env.APP_TIMEZONE);
    res.json({
      from: start.toISOString(),
      to: end.toISOString(),
      timeZone: env.APP_TIMEZONE,
      data: events,
    });
  } catch (err) {
    throw graphErrorStatus(err) < 500
      ? badRequest(err instanceof Error ? err.message : 'Could not read the calendar.')
      : serviceUnavailable(err instanceof Error ? err.message : 'Could not read the calendar.');
  }
}

/** DELETE /api/microsoft/meetings/:id — cancel an event. */
export async function deleteMeeting(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const eventId = req.params.id;
  if (typeof eventId !== 'string' || !eventId) throw notFound('No event id given.');

  const conn = await requireConnection(orgId, userId);

  try {
    await cancelEvent(conn.id, eventId);
  } catch (err) {
    throw graphErrorStatus(err) < 500
      ? badRequest(err instanceof Error ? err.message : 'Could not cancel the meeting.')
      : serviceUnavailable(err instanceof Error ? err.message : 'Could not cancel the meeting.');
  }

  res.status(204).end();
}
