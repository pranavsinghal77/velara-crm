import { Request, Response } from 'express';
import { prisma } from '../config/db';

export const getReminders = async (req: Request, res: Response) => {
  const reminders = await prisma.reminder.findMany({
    orderBy: { dueDate: 'asc' },
  });
  res.json(reminders);
};

export const createReminder = async (req: Request, res: Response) => {
  const reminder = await prisma.reminder.create({
    data: req.body,
  });
  res.status(201).json(reminder);
};

export const updateReminder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const reminder = await prisma.reminder.update({
    where: { id },
    data: req.body,
  });
  res.json(reminder);
};

export const deleteReminder = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.reminder.delete({
    where: { id },
  });
  res.json({ success: true });
};

export const toggleReminderCompleted = async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Reminder not found' });
  }
  const updated = await prisma.reminder.update({
    where: { id },
    data: { isCompleted: !existing.isCompleted },
  });
  res.json(updated);
};
