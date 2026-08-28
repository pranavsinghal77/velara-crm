import { Request, Response } from 'express';
import { prisma } from '../config/db';

export const getNotifications = async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { timestamp: 'desc' },
  });
  res.json(notifications);
};

export const createNotification = async (req: Request, res: Response) => {
  const notification = await prisma.notification.create({
    data: req.body,
  });
  res.status(201).json(notification);
};

export const markNotificationRead = async (req: Request, res: Response) => {
  const { id } = req.params;
  const notification = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
  res.json(notification);
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true });
};
