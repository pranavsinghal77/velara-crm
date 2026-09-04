import { LeadStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import {
  leadValueLakhsFromRow,
  serializeLead,
  serializeReminder,
} from '../utils/serializers';
import { fromDateAndTime } from '../utils/time';
import { createLeadViaTool } from '../services/leadWrite.service';

/**
 * Model Context Protocol endpoint.
 *
 * This makes the CRM addressable by a customer's own AI tooling: they point
 * Claude Desktop, an agent framework, or any MCP client at
 * `POST /api/mcp` with an API key, and it can read and update their CRM.
 *
 * Transport is JSON-RPC 2.0 over HTTP, which is the streamable-HTTP form of
 * MCP. Every call is already scoped to the key's organisation by
 * `authenticateApiKey`, so a tool implementation here cannot reach another
 * tenant even if it tried.
 *
 * Tool writes go through the same validation and metering as the REST API —
 * an MCP client is not a privileged back door.
 */

const PROTOCOL_VERSION = '2024-11-05';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const ok = (id: JsonRpcRequest['id'], result: unknown) => ({
  jsonrpc: '2.0' as const,
  id: id ?? null,
  result,
});

const fail = (id: JsonRpcRequest['id'], code: number, message: string, data?: unknown) => ({
  jsonrpc: '2.0' as const,
  id: id ?? null,
  error: { code, message, ...(data ? { data } : {}) },
});

/** Tool catalogue advertised to clients. */
const TOOLS = [
  {
    name: 'search_leads',
    description:
      'Search leads in the CRM by name, company, email or phone. Returns matching leads with their AI score, stage and deal value.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free text to match against name, company, email, phone' },
        status: {
          type: 'string',
          enum: Object.values(LeadStatus),
          description: 'Restrict to one pipeline stage',
        },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
    },
  },
  {
    name: 'get_lead',
    description: 'Fetch one lead by id, including its recent message history.',
    inputSchema: {
      type: 'object',
      properties: { leadId: { type: 'string', description: 'Lead id' } },
      required: ['leadId'],
    },
  },
  {
    name: 'create_lead',
    description: 'Create a new lead. Counts against the plan lead allowance.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        company: { type: 'string' },
        source: { type: 'string', default: 'API' },
        budget: { type: 'string', description: 'Free text, e.g. "3.5L" or "250000"' },
      },
      required: ['name', 'email'],
    },
  },
  {
    name: 'update_lead_status',
    description: 'Move a lead to a different pipeline stage.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        status: { type: 'string', enum: Object.values(LeadStatus) },
      },
      required: ['leadId', 'status'],
    },
  },
  {
    name: 'create_reminder',
    description: 'Schedule a follow-up reminder against a lead.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        task: { type: 'string' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD in the organisation timezone' },
        dueTime: { type: 'string', description: 'HH:mm, defaults to 09:00' },
        priority: { type: 'string', enum: ['High', 'Medium', 'Low'], default: 'Medium' },
      },
      required: ['task', 'dueDate'],
    },
  },
  {
    name: 'pipeline_summary',
    description:
      'Aggregate pipeline state: counts by stage and source, total and weighted value in INR lakhs, conversion rate.',
    inputSchema: { type: 'object', properties: {} },
  },
] as const;

/** Resources expose read-only context a client can attach to a conversation. */
const RESOURCES = [
  {
    uri: 'velara://pipeline/summary',
    name: 'Pipeline summary',
    description: 'Current pipeline aggregates for this organisation.',
    mimeType: 'application/json',
  },
  {
    uri: 'velara://leads/hot',
    name: 'Hot leads',
    description: 'Open leads flagged hot, highest AI score first.',
    mimeType: 'application/json',
  },
];

export async function handleMcp(req: Request, res: Response) {
  const body = req.body as JsonRpcRequest | JsonRpcRequest[];

  // Batches are part of JSON-RPC; handle them so compliant clients work.
  if (Array.isArray(body)) {
    const results = await Promise.all(body.map((entry) => dispatch(req, entry)));
    return res.json(results.filter(Boolean));
  }

  const result = await dispatch(req, body);
  // A notification (no id) gets an accepted-with-no-content response.
  if (!result) return res.status(202).end();
  res.json(result);
}

async function dispatch(req: Request, rpc: JsonRpcRequest) {
  const isNotification = rpc.id === undefined;

  if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    return isNotification ? null : fail(rpc.id, -32600, 'Invalid Request');
  }

  try {
    switch (rpc.method) {
      case 'initialize':
        return ok(rpc.id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: 'velara-crm', version: '1.0.0' },
        });

      case 'notifications/initialized':
      case 'ping':
        return isNotification ? null : ok(rpc.id, {});

      case 'tools/list':
        return ok(rpc.id, { tools: TOOLS });

      case 'resources/list':
        return ok(rpc.id, { resources: RESOURCES });

      case 'resources/read':
        return ok(rpc.id, await readResource(req, String(rpc.params?.uri ?? '')));

      case 'tools/call':
        return ok(
          rpc.id,
          await callTool(req, String(rpc.params?.name ?? ''), (rpc.params?.arguments ?? {}) as Record<string, unknown>)
        );

      default:
        return isNotification ? null : fail(rpc.id, -32601, `Unknown method: ${rpc.method}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tool execution failed';
    // Tool failures are reported in-band so the model can react, rather than
    // surfacing as a transport error.
    return isNotification ? null : fail(rpc.id, -32000, message);
  }
}

/** MCP tool results are content blocks; JSON goes back as pretty text. */
const jsonContent = (value: unknown, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  isError,
});

async function callTool(req: Request, name: string, args: Record<string, unknown>) {
  const { orgId, userId } = auth(req);

  switch (name) {
    case 'search_leads': {
      const limit = Math.min(Number(args.limit) || 10, 50);
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      const status = typeof args.status === 'string' ? (args.status as LeadStatus) : undefined;

      const leads = await prisma.lead.findMany({
        where: {
          orgId,
          ...(status ? { status } : {}),
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { company: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                  { phone: { contains: query } },
                ],
              }
            : {}),
        },
        orderBy: { aiScore: 'desc' },
        take: limit,
      });

      return jsonContent({ count: leads.length, leads: leads.map(serializeLead) });
    }

    case 'get_lead': {
      const leadId = String(args.leadId ?? '');
      const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
      if (!lead) return jsonContent({ error: 'Lead not found' }, true);

      const messages = await prisma.message.findMany({
        where: { orgId, leadId: lead.id },
        orderBy: { sentAt: 'desc' },
        take: 20,
        select: { direction: true, content: true, channel: true, sentAt: true },
      });

      return jsonContent({
        lead: serializeLead(lead),
        messages: messages.reverse().map((m) => ({
          direction: m.direction,
          channel: m.channel,
          content: m.content,
          sentAt: m.sentAt.toISOString(),
        })),
      });
    }

    case 'create_lead': {
      const created = await createLeadViaTool({
        orgId,
        actorId: userId.startsWith('apikey:') ? null : userId,
        apiKeyId: req.apiKeyId,
        input: {
          name: String(args.name ?? ''),
          email: String(args.email ?? ''),
          phone: args.phone ? String(args.phone) : '',
          company: args.company ? String(args.company) : undefined,
          source: args.source ? String(args.source) : 'API',
          budget: args.budget ? String(args.budget) : undefined,
        },
      });
      return jsonContent({ created: serializeLead(created) });
    }

    case 'update_lead_status': {
      const leadId = String(args.leadId ?? '');
      const status = String(args.status ?? '') as LeadStatus;
      if (!Object.values(LeadStatus).includes(status)) {
        return jsonContent({ error: `Invalid status. Expected one of ${Object.values(LeadStatus).join(', ')}` }, true);
      }

      const { count } = await prisma.lead.updateMany({
        where: { id: leadId, orgId },
        data: { status },
      });
      if (count === 0) return jsonContent({ error: 'Lead not found' }, true);

      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
      return jsonContent({ updated: serializeLead(lead) });
    }

    case 'create_reminder': {
      const dueDate = String(args.dueDate ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return jsonContent({ error: 'dueDate must be YYYY-MM-DD' }, true);
      }

      const leadId = args.leadId ? String(args.leadId) : null;
      const lead = leadId
        ? await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { id: true, name: true } })
        : null;
      if (leadId && !lead) return jsonContent({ error: 'Lead not found' }, true);

      const reminder = await prisma.reminder.create({
        data: {
          orgId,
          leadId: lead?.id ?? null,
          leadName: lead?.name ?? '',
          task: String(args.task ?? ''),
          dueAt: fromDateAndTime(dueDate, typeof args.dueTime === 'string' ? args.dueTime : '09:00'),
          priority: (['High', 'Medium', 'Low'] as const).includes(args.priority as never)
            ? (args.priority as 'High' | 'Medium' | 'Low')
            : 'Medium',
          type: 'AI-Generated',
        },
      });

      return jsonContent({ created: serializeReminder(reminder) });
    }

    case 'pipeline_summary':
      return jsonContent(await pipelineSummary(orgId));

    default:
      return jsonContent({ error: `Unknown tool: ${name}` }, true);
  }
}

async function readResource(req: Request, uri: string) {
  const { orgId } = auth(req);

  if (uri === 'velara://pipeline/summary') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(await pipelineSummary(orgId), null, 2),
        },
      ],
    };
  }

  if (uri === 'velara://leads/hot') {
    const leads = await prisma.lead.findMany({
      where: { orgId, isHot: true, status: { notIn: [LeadStatus.Won, LeadStatus.Lost] } },
      orderBy: { aiScore: 'desc' },
      take: 25,
    });
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(leads.map(serializeLead), null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
}

async function pipelineSummary(orgId: string) {
  const [byStatus, bySource, totals, wonTotals] = await Promise.all([
    prisma.lead.groupBy({ by: ['status'], where: { orgId }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['source'], where: { orgId }, _count: { _all: true } }),
    prisma.lead.aggregate({
      where: { orgId },
      _count: { _all: true },
      _sum: { budgetLakhs: true },
      _avg: { aiScore: true },
    }),
    prisma.lead.aggregate({
      where: { orgId, status: LeadStatus.Won },
      _count: { _all: true },
      _sum: { budgetLakhs: true },
    }),
  ]);

  const openLeads = await prisma.lead.findMany({
    where: { orgId, status: { notIn: [LeadStatus.Won, LeadStatus.Lost] } },
    select: { status: true, budgetLakhs: true },
  });

  const total = totals._count._all;
  const won = wonTotals._count._all;

  return {
    totalLeads: total,
    byStage: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
    bySource: Object.fromEntries(bySource.map((r) => [r.source, r._count._all])),
    pipelineValueLakhs: round2(totals._sum.budgetLakhs ?? 0),
    weightedValueLakhs: round2(leadValueLakhsFromRow(openLeads)),
    wonValueLakhs: round2(wonTotals._sum.budgetLakhs ?? 0),
    conversionRatePercent: total > 0 ? Math.round((won / total) * 100) : 0,
    averageAiScore: Math.round(totals._avg.aiScore ?? 0),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
