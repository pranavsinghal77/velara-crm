import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { validatedParams, validatedQuery } from '../middlewares/validate';
import type { CreateNotificationInput, IdParam, PaginationQuery } from '../schemas';
import { badRequest, notFound } from '../utils/httpError';
import { serializeNotification } from '../utils/serializers';
import { orgRoom } from '../realtime';

/**
 * Notifications are visible to their addressee, plus org-wide broadcasts
 * (`userId: null`). A user cannot read another member's notifications.
 */
export async function getNotifications(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const { limit, cursor } = validatedQuery<PaginationQuery>(req);

  const rows = await prisma.notification.findMany({
    where: { orgId, OR: [{ userId }, { userId: null }] },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  res.json({
    data: page.map(serializeNotification),
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
  });
}

/** POST /api/notifications - Manager and above. */
export async function createNotification(req: Request, res: Response) {
  const { orgId } = auth(req);
  const input = req.body as CreateNotificationInput;

  if (input.userId) {
    const member = await prisma.user.findFirst({
      where: { id: input.userId, orgId },
      select: { id: true },
    });
    if (!member) throw badRequest('userId must be a member of your organisation');
  }

  const notification = await prisma.notification.create({
    data: {
      orgId,
      userId: input.userId ?? null,
      title: input.title,
      message: input.message,
      type: input.type,
    },
  });

  const payload = serializeNotification(notification);
  req.app.get('io')?.to(orgRoom(orgId)).emit('notification:created', payload);

  res.status(201).json(payload);
}

/** PUT /api/notifications/:id/read */
export async function markNotificationRead(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const { count } = await prisma.notification.updateMany({
    where: { id, orgId, OR: [{ userId }, { userId: null }] },
    data: { isRead: true },
  });
  if (count === 0) throw notFound('Notification not found');

  const notification = await prisma.notification.findUniqueOrThrow({ where: { id } });
  res.json(serializeNotification(notification));
}

/** PUT /api/notifications/read-all */
export async function markAllNotificationsRead(req: Request, res: Response) {
  const { orgId, userId } = auth(req);

  const { count } = await prisma.notification.updateMany({
    where: { orgId, isRead: false, OR: [{ userId }, { userId: null }] },
    data: { isRead: true },
  });

  res.json({ success: true, updated: count });
}
