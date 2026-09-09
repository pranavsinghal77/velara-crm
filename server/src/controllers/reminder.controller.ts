import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { validatedParams, validatedQuery } from '../middlewares/validate';
import type {
  CreateReminderInput,
  IdParam,
  ReminderListQuery,
  UpdateReminderInput,
} from '../schemas';
import { badRequest, notFound } from '../utils/httpError';
import { serializeReminder } from '../utils/serializers';
import { fromDateAndTime, toDateString, toTimeString } from '../utils/time';

async function resolveLead(orgId: string, leadId: string | null | undefined) {
  if (!leadId) return null;
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId },
    select: { id: true, name: true },
  });
  if (!lead) throw badRequest('leadId does not reference a lead in your organisation');
  return lead;
}

/** GET /api/reminders */
export async function getReminders(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { limit, cursor, completed, from, to } = validatedQuery<ReminderListQuery>(req);

  const where: Prisma.ReminderWhereInput = {
    orgId,
    ...(completed !== undefined ? { isCompleted: completed } : {}),
    ...(from || to
      ? {
          dueAt: {
            ...(from ? { gte: fromDateAndTime(from, '00:00') } : {}),
            // `to` is inclusive of the whole day.
            ...(to ? { lt: fromDateAndTime(to, '00:00') } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.reminder.findMany({
    where,
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const now = new Date();

  res.json({
    data: page.map((r) => serializeReminder(r, now)),
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
  });
}

/** POST /api/reminders */
export async function createReminder(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const input = req.body as CreateReminderInput;

  const lead = await resolveLead(orgId, input.leadId);

  const reminder = await prisma.reminder.create({
    data: {
      orgId,
      ownerId: userId,
      leadId: lead?.id ?? null,
      leadName: lead?.name ?? input.leadName,
      task: input.task,
      dueAt: fromDateAndTime(input.dueDate, input.dueTime),
      priority: input.priority,
      type: input.type,
      notes: input.notes,
    },
  });

  res.status(201).json(serializeReminder(reminder));
}

/** PUT /api/reminders/:id */
export async function updateReminder(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);
  const input = req.body as UpdateReminderInput;

  const existing = await prisma.reminder.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Reminder not found');

  const data: Prisma.ReminderUpdateInput = {};

  if (input.task !== undefined) data.task = input.task;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.type !== undefined) data.type = input.type;
  if (input.notes !== undefined) data.notes = input.notes;

  // Either half of the due date/time may be supplied on its own, so the
  // missing half is read back from the stored instant instead of silently
  // defaulting to 09:00 and moving the reminder.
  if (input.dueDate !== undefined || input.dueTime !== undefined) {
    data.dueAt = fromDateAndTime(
      input.dueDate ?? toDateString(existing.dueAt),
      input.dueTime ?? toTimeString(existing.dueAt)
    );
  }

  if (input.isCompleted !== undefined) {
    data.isCompleted = input.isCompleted;
    data.completedAt = input.isCompleted ? new Date() : null;
  }

  if (input.leadId !== undefined) {
    const lead = await resolveLead(orgId, input.leadId);
    data.lead = lead ? { connect: { id: lead.id } } : { disconnect: true };
    if (lead) data.leadName = lead.name;
  }
  if (input.leadName !== undefined && input.leadId === undefined) {
    data.leadName = input.leadName;
  }

  const reminder = await prisma.reminder.update({ where: { id }, data });
  res.json(serializeReminder(reminder));
}

/** PUT /api/reminders/:id/toggle */
export async function toggleReminderCompleted(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const existing = await prisma.reminder.findFirst({
    where: { id, orgId },
    select: { id: true, isCompleted: true },
  });
  if (!existing) throw notFound('Reminder not found');

  const reminder = await prisma.reminder.update({
    where: { id },
    data: {
      isCompleted: !existing.isCompleted,
      completedAt: existing.isCompleted ? null : new Date(),
    },
  });

  res.json(serializeReminder(reminder));
}

/** DELETE /api/reminders/:id */
export async function deleteReminder(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const { count } = await prisma.reminder.deleteMany({ where: { id, orgId } });
  if (count === 0) throw notFound('Reminder not found');

  res.status(204).end();
}
