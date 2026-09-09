import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { validatedParams, validatedQuery } from '../middlewares/validate';
import type { CreateMessageInput, IdParam, MessageListQuery } from '../schemas';
import { badRequest, notFound } from '../utils/httpError';
import { serializeMessage } from '../utils/serializers';
import { orgRoom } from '../realtime';

/** GET /api/messages */
export async function getMessages(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { limit, cursor, leadId, unreadOnly } = validatedQuery<MessageListQuery>(req);

  const where: Prisma.MessageWhereInput = {
    orgId,
    ...(leadId ? { leadId } : {}),
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const rows = await prisma.message.findMany({
    where,
    orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  res.json({
    // Oldest-first is what a conversation view wants; the query above is
    // newest-first only so the cursor walks backwards through history.
    data: page.map(serializeMessage).reverse(),
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
  });
}

/** POST /api/messages */
export async function createMessage(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const input = req.body as CreateMessageInput;

  if (input.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, orgId },
      select: { id: true },
    });
    if (!lead) throw badRequest('leadId does not reference a lead in your organisation');
  }

  const message = await prisma.message.create({
    data: {
      orgId,
      leadId: input.leadId ?? null,
      authorId: userId,
      content: input.content,
      direction: input.sender,
      channel: input.channel,
      isAISuggested: input.isAISuggested,
      isInternal: input.isInternal,
      intent: input.intent,
      urgency: input.urgency,
      // Outbound messages are read by definition.
      isRead: input.sender === 'sent',
    },
  });

  const payload = serializeMessage(message);

  // Broadcast only to the originating organisation. The previous version
  // emitted every message to every connected socket, across all tenants.
  req.app.get('io')?.to(orgRoom(orgId)).emit('message:created', payload);

  res.status(201).json(payload);
}

/** PUT /api/messages/:id/read */
export async function markMessageRead(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const { count } = await prisma.message.updateMany({
    where: { id, orgId },
    data: { isRead: true },
  });
  if (count === 0) throw notFound('Message not found');

  const message = await prisma.message.findUniqueOrThrow({ where: { id } });
  res.json(serializeMessage(message));
}

/** PUT /api/messages/read-all */
export async function markAllMessagesRead(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { count } = await prisma.message.updateMany({
    where: { orgId, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true, updated: count });
}
