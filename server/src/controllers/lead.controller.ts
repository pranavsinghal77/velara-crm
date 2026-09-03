import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { validatedParams, validatedQuery } from '../middlewares/validate';
import type {
  CreateLeadInput,
  IdParam,
  LeadListQuery,
  UpdateLeadInput,
} from '../schemas';
import { badRequest, notFound } from '../utils/httpError';
import { parseBudgetToLakhs, serializeLead } from '../utils/serializers';
import { fromDateAndTime } from '../utils/time';

/**
 * Confirms a user id belongs to the caller's organisation before it is stored
 * as a lead owner. Without this check, a valid uuid from another tenant could
 * be assigned as the owner.
 */
async function assertOrgMember(orgId: string, userId: string | null | undefined) {
  if (!userId) return null;
  const member = await prisma.user.findFirst({
    where: { id: userId, orgId },
    select: { id: true },
  });
  if (!member) throw badRequest('assignedTo must be a user in your organisation');
  return member.id;
}

/**
 * GET /api/leads
 *
 * Cursor-paginated and org-scoped. The previous version was an unbounded
 * `findMany()` across every tenant.
 */
export async function getLeads(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { limit, cursor, status, isHot, search, ownerId } =
    validatedQuery<LeadListQuery>(req);

  const where: Prisma.LeadWhereInput = {
    orgId,
    ...(status ? { status } : {}),
    ...(isHot !== undefined ? { isHot } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  const rows = await prisma.lead.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  res.json({
    data: page.map(serializeLead),
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
  });
}

/** GET /api/leads/:id */
export async function getLead(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const lead = await prisma.lead.findFirst({ where: { id, orgId } });
  if (!lead) throw notFound('Lead not found');

  res.json(serializeLead(lead));
}

/** POST /api/leads */
export async function createLead(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const input = req.body as CreateLeadInput;

  // Default ownership to the creator rather than leaving leads unassigned.
  const ownerId =
    input.assignedTo === undefined
      ? userId
      : await assertOrgMember(orgId, input.assignedTo);

  const lead = await prisma.lead.create({
    data: {
      orgId,
      ownerId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      status: input.status,
      aiScore: input.aiScore,
      aiScoreBreakdown: input.aiScoreBreakdown ?? undefined,
      isHot: input.isHot,
      tags: input.tags,
      notes: input.notes,
      company: input.company,
      designation: input.designation,
      city: input.city,
      budget: input.budget,
      budgetLakhs: parseBudgetToLakhs(input.budget),
      lastContactAt: input.lastContact ? fromDateAndTime(input.lastContact) : null,
    },
  });

  res.status(201).json(serializeLead(lead));
}

/**
 * PUT /api/leads/:id
 *
 * Fields are copied across explicitly. `orgId` and `id` are not assignable,
 * so a lead cannot be moved between tenants by a crafted payload.
 */
export async function updateLead(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);
  const input = req.body as UpdateLeadInput;

  const existing = await prisma.lead.findFirst({
    where: { id, orgId },
    select: { id: true, name: true },
  });
  if (!existing) throw notFound('Lead not found');

  const data: Prisma.LeadUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) data.email = input.email;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.source !== undefined) data.source = input.source;
  if (input.status !== undefined) data.status = input.status;
  if (input.aiScore !== undefined) data.aiScore = input.aiScore;
  if (input.aiScoreBreakdown !== undefined) data.aiScoreBreakdown = input.aiScoreBreakdown;
  if (input.isHot !== undefined) data.isHot = input.isHot;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.company !== undefined) data.company = input.company;
  if (input.designation !== undefined) data.designation = input.designation;
  if (input.city !== undefined) data.city = input.city;
  if (input.budget !== undefined) {
    data.budget = input.budget;
    data.budgetLakhs = parseBudgetToLakhs(input.budget);
  }
  if (input.lastContact !== undefined) {
    data.lastContactAt = fromDateAndTime(input.lastContact);
  }
  if (input.assignedTo !== undefined) {
    const ownerId = await assertOrgMember(orgId, input.assignedTo);
    data.owner = ownerId ? { connect: { id: ownerId } } : { disconnect: true };
  }

  const lead = await prisma.lead.update({ where: { id }, data });

  // Keep the denormalised name on reminders in step with the lead.
  if (input.name !== undefined && input.name !== existing.name) {
    await prisma.reminder.updateMany({
      where: { orgId, leadId: id },
      data: { leadName: input.name },
    });
  }

  res.json(serializeLead(lead));
}

/** DELETE /api/leads/:id */
export async function deleteLead(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  // deleteMany scoped by orgId means a foreign id deletes nothing rather than
  // throwing after the fact.
  const { count } = await prisma.lead.deleteMany({ where: { id, orgId } });
  if (count === 0) throw notFound('Lead not found');

  res.status(204).end();
}
