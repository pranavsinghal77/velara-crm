import crypto from 'crypto';
import { ConnectionStatus, McpTransport } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { auth } from '../middlewares/auth';
import { API_SCOPES, generateApiKey } from '../middlewares/apiKey';
import { validatedParams } from '../middlewares/validate';
import { currentUsage } from '../billing/usage.service';
import { PLANS } from '../billing/plans';
import { decrypt, encrypt, encryptionAvailable, hint } from '../utils/encryption';
import { badRequest, notFound, serviceUnavailable } from '../utils/httpError';
import type { IdParam } from '../schemas';

/**
 * Tenant-facing connectivity settings: API keys, outbound MCP servers, AI
 * credentials and webhooks. All Admin-only — these are the levers that let data
 * leave the workspace.
 */

function requireEncryption() {
  if (!encryptionAvailable()) {
    throw serviceUnavailable(
      'This server has no ENCRYPTION_KEY configured, so credentials cannot be stored securely. Ask your administrator to set one.'
    );
  }
}

// --- API keys ----------------------------------------------------------------

/** GET /api/connectivity/api-keys */
export async function listApiKeys(req: Request, res: Response) {
  const { orgId } = auth(req);

  const keys = await prisma.apiKey.findMany({
    where: { orgId },
    orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }],
  });

  res.json({
    data: keys.map((k) => ({
      id: k.id,
      name: k.name,
      // The prefix only; the key itself was shown once at creation.
      prefix: `${k.prefix}...`,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      lastUsedIp: k.lastUsedIp,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      revokedAt: k.revokedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
    availableScopes: API_SCOPES,
  });
}

/**
 * POST /api/connectivity/api-keys
 *
 * The plaintext key appears in this response and nowhere else, ever. There is
 * no endpoint to retrieve it again, because we only keep its hash.
 */
export async function createApiKey(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const { name, scopes, expiresInDays } = req.body as {
    name: string;
    scopes: string[];
    expiresInDays?: number | null;
  };

  const live = await prisma.apiKey.count({ where: { orgId, revokedAt: null } });
  if (live >= 25) {
    throw badRequest('This workspace already has 25 active API keys. Revoke one first.');
  }

  const generated = generateApiKey();

  const key = await prisma.apiKey.create({
    data: {
      orgId,
      name,
      prefix: generated.prefix,
      keyHash: generated.keyHash,
      scopes,
      createdById: userId,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
    },
  });

  res.status(201).json({
    id: key.id,
    name: key.name,
    scopes: key.scopes,
    expiresAt: key.expiresAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
    key: generated.plaintext,
    warning: 'Copy this key now. It cannot be shown again.',
  });
}

/** DELETE /api/connectivity/api-keys/:id — revoke, never hard-delete. */
export async function revokeApiKey(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  // Revoking rather than deleting keeps the audit trail: usage events
  // reference the key id.
  const { count } = await prisma.apiKey.updateMany({
    where: { id, orgId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw notFound('API key not found or already revoked');

  res.status(204).end();
}

// --- MCP connections ---------------------------------------------------------

const serializeMcp = (c: {
  id: string;
  name: string;
  transport: McpTransport;
  url: string;
  credentialEnc: string | null;
  credentialHeader: string;
  enabled: boolean;
  status: ConnectionStatus;
  statusDetail: string | null;
  discoveredTools: string[];
  lastCheckedAt: Date | null;
}) => ({
  id: c.id,
  name: c.name,
  transport: c.transport,
  url: c.url,
  hasCredential: Boolean(c.credentialEnc),
  credentialHeader: c.credentialHeader,
  enabled: c.enabled,
  status: c.status,
  statusDetail: c.statusDetail,
  discoveredTools: c.discoveredTools,
  lastCheckedAt: c.lastCheckedAt?.toISOString() ?? null,
});

/** GET /api/connectivity/mcp */
export async function listMcpConnections(req: Request, res: Response) {
  const { orgId } = auth(req);
  const rows = await prisma.mcpConnection.findMany({ where: { orgId }, orderBy: { name: 'asc' } });
  res.json({ data: rows.map(serializeMcp) });
}

/** POST /api/connectivity/mcp */
export async function createMcpConnection(req: Request, res: Response) {
  const { orgId } = auth(req);
  const body = req.body as {
    name: string;
    url: string;
    transport: McpTransport;
    credential?: string;
    credentialHeader?: string;
  };

  if (body.credential) requireEncryption();

  const created = await prisma.mcpConnection.create({
    data: {
      orgId,
      name: body.name,
      url: body.url,
      transport: body.transport,
      credentialEnc: body.credential ? encrypt(body.credential) : null,
      credentialHeader: body.credentialHeader ?? 'Authorization',
    },
  });

  res.status(201).json(serializeMcp(created));
}

/** PUT /api/connectivity/mcp/:id */
export async function updateMcpConnection(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);
  const body = req.body as {
    name?: string;
    url?: string;
    transport?: McpTransport;
    credential?: string | null;
    credentialHeader?: string;
    enabled?: boolean;
  };

  const existing = await prisma.mcpConnection.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Connection not found');

  if (body.credential) requireEncryption();

  const updated = await prisma.mcpConnection.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.url !== undefined ? { url: body.url } : {}),
      ...(body.transport !== undefined ? { transport: body.transport } : {}),
      ...(body.credentialHeader !== undefined ? { credentialHeader: body.credentialHeader } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      // An explicit null clears the stored credential; undefined leaves it be.
      ...(body.credential === null
        ? { credentialEnc: null }
        : body.credential
          ? { credentialEnc: encrypt(body.credential) }
          : {}),
      // Any change to the endpoint invalidates the last health verdict.
      ...(body.url !== undefined || body.credential !== undefined
        ? { status: ConnectionStatus.Unchecked, discoveredTools: [], statusDetail: null }
        : {}),
    },
  });

  res.json(serializeMcp(updated));
}

/** DELETE /api/connectivity/mcp/:id */
export async function deleteMcpConnection(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const { count } = await prisma.mcpConnection.deleteMany({ where: { id, orgId } });
  if (count === 0) throw notFound('Connection not found');

  res.status(204).end();
}

/**
 * POST /api/connectivity/mcp/:id/test
 *
 * Performs a real MCP handshake (`initialize` then `tools/list`) and records
 * the outcome, so the UI shows a verified status rather than an assumed one.
 */
export async function testMcpConnection(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const conn = await prisma.mcpConnection.findFirst({ where: { id, orgId } });
  if (!conn) throw notFound('Connection not found');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };

  if (conn.credentialEnc) {
    const credential = decrypt(conn.credentialEnc);
    headers[conn.credentialHeader] =
      conn.credentialHeader.toLowerCase() === 'authorization' && !/^\w+ /.test(credential)
        ? `Bearer ${credential}`
        : credential;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let status: ConnectionStatus = ConnectionStatus.Unreachable;
  let detail: string | null = null;
  let tools: string[] = [];

  try {
    const handshake = await fetch(conn.url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'velara-crm', version: '1.0.0' },
        },
      }),
    });

    if (handshake.status === 401 || handshake.status === 403) {
      status = ConnectionStatus.Unauthorized;
      detail = `Server rejected the credential (HTTP ${handshake.status}).`;
    } else if (!handshake.ok) {
      detail = `Server returned HTTP ${handshake.status}.`;
    } else {
      const listed = await fetch(conn.url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      });

      if (listed.ok) {
        const payload = (await listed.json().catch(() => null)) as
          | { result?: { tools?: { name?: string }[] } }
          | null;
        tools = (payload?.result?.tools ?? [])
          .map((t) => t.name)
          .filter((n): n is string => Boolean(n));
        status = ConnectionStatus.Healthy;
        detail = `Handshake succeeded; ${tools.length} tool(s) advertised.`;
      } else {
        status = ConnectionStatus.Healthy;
        detail = 'Handshake succeeded, but tools/list was not available.';
      }
    }
  } catch (err) {
    detail =
      err instanceof Error && err.name === 'AbortError'
        ? 'Server did not respond within 10 seconds.'
        : 'Could not reach the server.';
  } finally {
    clearTimeout(timer);
  }

  const updated = await prisma.mcpConnection.update({
    where: { id },
    data: { status, statusDetail: detail, discoveredTools: tools, lastCheckedAt: new Date() },
  });

  res.json(serializeMcp(updated));
}

// --- AI provider -------------------------------------------------------------

/** GET /api/connectivity/ai */
export async function getAiConfig(req: Request, res: Response) {
  const { orgId } = auth(req);

  const config = await prisma.aiProviderConfig.findUnique({ where: { orgId } });
  const usage = await currentUsage(orgId);
  const plan = PLANS[usage.subscription.tier];

  res.json({
    config: config
      ? {
          provider: config.provider,
          model: config.model,
          visionModel: config.visionModel,
          enabled: config.enabled,
          hasOwnKey: Boolean(config.apiKeyEnc),
          monthlyBudgetPaise: config.monthlyBudgetPaise,
        }
      : null,
    // What the tenant is using right now, so the settings page can show the
    // real position rather than just the configuration.
    platformKeyAvailable: env.aiEnabled,
    usage: {
      aiRequests: usage.byKind.ai_request?.quantity ?? 0,
      aiCostPaise: usage.byKind.ai_request?.costPaise ?? 0,
      includedRequests: usage.limits.ai_request,
      periodEnd: usage.period.end.toISOString(),
    },
    plan: { tier: plan.tier, name: plan.name },
  });
}

/** PUT /api/connectivity/ai */
export async function updateAiConfig(req: Request, res: Response) {
  const { orgId } = auth(req);
  const body = req.body as {
    apiKey?: string | null;
    model?: string;
    visionModel?: string;
    enabled?: boolean;
    monthlyBudgetPaise?: number | null;
  };

  if (body.apiKey) requireEncryption();

  const data = {
    ...(body.model !== undefined ? { model: body.model } : {}),
    ...(body.visionModel !== undefined ? { visionModel: body.visionModel } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.monthlyBudgetPaise !== undefined
      ? { monthlyBudgetPaise: body.monthlyBudgetPaise }
      : {}),
    ...(body.apiKey === null
      ? { apiKeyEnc: null }
      : body.apiKey
        ? { apiKeyEnc: encrypt(body.apiKey) }
        : {}),
  };

  const config = await prisma.aiProviderConfig.upsert({
    where: { orgId },
    create: { orgId, ...data },
    update: data,
  });

  res.json({
    provider: config.provider,
    model: config.model,
    visionModel: config.visionModel,
    enabled: config.enabled,
    hasOwnKey: Boolean(config.apiKeyEnc),
    keyHint: body.apiKey ? hint(body.apiKey) : undefined,
    monthlyBudgetPaise: config.monthlyBudgetPaise,
  });
}

// --- Webhooks ----------------------------------------------------------------

export const WEBHOOK_EVENTS = [
  'lead.created',
  'lead.status_changed',
  'message.received',
  'reminder.overdue',
] as const;

/** GET /api/connectivity/webhooks */
export async function listWebhooks(req: Request, res: Response) {
  const { orgId } = auth(req);
  const rows = await prisma.webhookEndpoint.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    data: rows.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      enabled: w.enabled,
      failureCount: w.failureCount,
      lastAttemptAt: w.lastAttemptAt?.toISOString() ?? null,
      lastStatus: w.lastStatus,
      createdAt: w.createdAt.toISOString(),
    })),
    availableEvents: WEBHOOK_EVENTS,
  });
}

/**
 * POST /api/connectivity/webhooks
 *
 * Returns the signing secret once. Receivers verify
 * `X-Velara-Signature: t=<ts>,v1=<hmac>` over `<ts>.<rawBody>`.
 */
export async function createWebhook(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { url, events } = req.body as { url: string; events: string[] };

  requireEncryption();

  const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;

  const created = await prisma.webhookEndpoint.create({
    data: { orgId, url, events, secretEnc: encrypt(secret) },
  });

  res.status(201).json({
    id: created.id,
    url: created.url,
    events: created.events,
    enabled: created.enabled,
    secret,
    warning: 'Copy this signing secret now. It cannot be shown again.',
  });
}

/** PUT /api/connectivity/webhooks/:id */
export async function updateWebhook(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);
  const body = req.body as { url?: string; events?: string[]; enabled?: boolean };

  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Webhook not found');

  const updated = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      ...(body.url !== undefined ? { url: body.url } : {}),
      ...(body.events !== undefined ? { events: body.events } : {}),
      // Re-enabling clears the failure count so the backoff starts fresh.
      ...(body.enabled !== undefined
        ? { enabled: body.enabled, ...(body.enabled ? { failureCount: 0 } : {}) }
        : {}),
    },
  });

  res.json({
    id: updated.id,
    url: updated.url,
    events: updated.events,
    enabled: updated.enabled,
    failureCount: updated.failureCount,
  });
}

/** DELETE /api/connectivity/webhooks/:id */
export async function deleteWebhook(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const { count } = await prisma.webhookEndpoint.deleteMany({ where: { id, orgId } });
  if (count === 0) throw notFound('Webhook not found');

  res.status(204).end();
}

/** GET /api/connectivity/overview — what the Settings page needs in one call. */
export async function getConnectivityOverview(req: Request, res: Response) {
  const { orgId } = auth(req);

  const [keys, mcp, webhooks, aiConfig, usage] = await Promise.all([
    prisma.apiKey.count({ where: { orgId, revokedAt: null } }),
    prisma.mcpConnection.count({ where: { orgId, enabled: true } }),
    prisma.webhookEndpoint.count({ where: { orgId, enabled: true } }),
    prisma.aiProviderConfig.findUnique({ where: { orgId } }),
    currentUsage(orgId),
  ]);

  res.json({
    apiKeys: keys,
    mcpConnections: mcp,
    webhooks,
    ai: {
      usingOwnKey: Boolean(aiConfig?.apiKeyEnc),
      model: aiConfig?.model ?? env.GEMINI_MODEL,
      enabled: aiConfig?.enabled ?? env.aiEnabled,
    },
    plan: {
      tier: usage.subscription.tier,
      status: usage.subscription.status,
      periodEnd: usage.period.end.toISOString(),
    },
    limits: usage.limits,
    usage: usage.byKind,
    encryptionAvailable: encryptionAvailable(),
    // The base URL a client points an MCP client or API integration at.
    endpoints: {
      rest: '/api',
      mcp: '/api/mcp',
    },
  });
}
