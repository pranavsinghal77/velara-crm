import { LeadStatus, UsageKind, type Lead } from '@prisma/client';
import { prisma } from '../config/db';
import { assertWithinLimit, record } from '../billing/usage.service';
import { parseBudgetToLakhs } from '../utils/serializers';
import { fromDateAndTime } from '../utils/time';
import { dispatchEvent } from './events.service';

/**
 * Single path for creating a lead.
 *
 * The REST controller, the MCP tool and any future importer all come through
 * here, so plan limits, metering, budget normalisation and workflow triggers
 * cannot be bypassed by whichever entry point a caller happens to use.
 */
export interface CreateLeadFields {
  name: string;
  email: string;
  phone?: string;
  source?: string;
  status?: LeadStatus;
  aiScore?: number;
  aiScoreBreakdown?: unknown;
  isHot?: boolean;
  tags?: string[];
  notes?: string;
  company?: string;
  designation?: string;
  city?: string;
  budget?: string;
  lastContact?: string;
}

export async function createLeadViaTool(params: {
  orgId: string;
  actorId: string | null;
  apiKeyId?: string;
  ownerId?: string | null;
  input: CreateLeadFields;
}): Promise<Lead> {
  const { orgId, actorId, apiKeyId, ownerId, input } = params;

  // Refuse before writing, so a tenant over its allowance does not end up with
  // a record it was not entitled to create.
  await assertWithinLimit(orgId, UsageKind.lead_created);

  const lead = await prisma.lead.create({
    data: {
      orgId,
      ownerId: ownerId === undefined ? actorId : ownerId,
      name: input.name,
      email: input.email,
      phone: input.phone ?? '',
      source: input.source ?? 'Website',
      status: input.status ?? LeadStatus.New,
      aiScore: input.aiScore ?? 50,
      aiScoreBreakdown: (input.aiScoreBreakdown ?? undefined) as never,
      isHot: input.isHot ?? false,
      tags: input.tags ?? [],
      notes: input.notes ?? '',
      company: input.company,
      designation: input.designation,
      city: input.city,
      budget: input.budget,
      budgetLakhs: parseBudgetToLakhs(input.budget),
      lastContactAt: input.lastContact ? fromDateAndTime(input.lastContact) : null,
    },
  });

  await record(
    { orgId, userId: actorId ?? undefined, apiKeyId },
    UsageKind.lead_created,
    { metadata: { source: lead.source, via: apiKeyId ? 'api' : 'app' } }
  );

  // Fires workflows and outbound webhooks subscribed to lead.created.
  void dispatchEvent({ orgId, type: 'lead.created', payload: { leadId: lead.id, lead } });

  return lead;
}
