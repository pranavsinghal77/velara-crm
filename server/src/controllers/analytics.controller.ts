import { Request, Response } from 'express';
import { prisma } from '../config/db';

export const getOverview = async (req: Request, res: Response) => {
  const [leads, messages, reminders, users] = await Promise.all([
    prisma.lead.findMany(),
    prisma.message.findMany(),
    prisma.reminder.findMany(),
    prisma.user.findMany(),
  ]);

  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => l.isHot).length;
  const wonLeads = leads.filter((l) => l.status === 'Won').length;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  // Group by status
  const statusCounts = leads.reduce((acc: Record<string, number>, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  // Group by source
  const sourceCounts = leads.reduce((acc: Record<string, number>, l) => {
    acc[l.source] = (acc[l.source] || 0) + 1;
    return acc;
  }, {});

  // Average AI Score
  const avgAiScore =
    totalLeads > 0
      ? Math.round(leads.reduce((sum, l) => sum + (l.aiScore || 0), 0) / totalLeads)
      : 0;

  res.json({
    totalLeads,
    hotLeads,
    wonLeads,
    conversionRate,
    avgAiScore,
    statusCounts,
    sourceCounts,
    totalMessages: messages.length,
    pendingReminders: reminders.filter((r) => !r.isCompleted).length,
    activeUsers: users.filter((u) => u.isActive).length,
  });
};
