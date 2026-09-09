import type { Request, Response } from 'express';
import { LeadStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { addDays, startOfToday, toDateString } from '../utils/time';

/**
 * GET /api/analytics/overview
 *
 * All aggregation happens in Postgres. The previous implementation pulled
 * every lead, message, reminder and user into Node and counted them in
 * JavaScript, which is both slow and unbounded in memory.
 */
export async function getOverview(req: Request, res: Response) {
  const { orgId } = auth(req);

  const [
    totalLeads,
    hotLeads,
    byStatus,
    bySource,
    scoreAndValue,
    totalMessages,
    unreadMessages,
    pendingReminders,
    overdueReminders,
    activeUsers,
  ] = await Promise.all([
    prisma.lead.count({ where: { orgId } }),
    prisma.lead.count({ where: { orgId, isHot: true } }),
    prisma.lead.groupBy({ by: ['status'], where: { orgId }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['source'], where: { orgId }, _count: { _all: true } }),
    prisma.lead.aggregate({
      where: { orgId },
      _avg: { aiScore: true },
      _sum: { budgetLakhs: true },
    }),
    prisma.message.count({ where: { orgId } }),
    prisma.message.count({ where: { orgId, isRead: false } }),
    prisma.reminder.count({ where: { orgId, isCompleted: false } }),
    prisma.reminder.count({
      where: { orgId, isCompleted: false, dueAt: { lt: new Date() } },
    }),
    prisma.user.count({ where: { orgId, isActive: true } }),
  ]);

  const statusCounts = Object.fromEntries(
    byStatus.map((row) => [row.status, row._count._all])
  ) as Record<string, number>;

  const sourceCounts = Object.fromEntries(
    bySource.map((row) => [row.source, row._count._all])
  );

  const wonLeads = statusCounts[LeadStatus.Won] ?? 0;
  const wonValue = await prisma.lead.aggregate({
    where: { orgId, status: LeadStatus.Won },
    _sum: { budgetLakhs: true },
  });

  res.json({
    totalLeads,
    hotLeads,
    wonLeads,
    lostLeads: statusCounts[LeadStatus.Lost] ?? 0,
    conversionRate: totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0,
    avgAiScore: Math.round(scoreAndValue._avg.aiScore ?? 0),
    pipelineValueLakhs: round2(scoreAndValue._sum.budgetLakhs ?? 0),
    wonValueLakhs: round2(wonValue._sum.budgetLakhs ?? 0),
    avgDealSizeLakhs: wonLeads > 0 ? round2((wonValue._sum.budgetLakhs ?? 0) / wonLeads) : 0,
    statusCounts,
    sourceCounts,
    totalMessages,
    unreadMessages,
    pendingReminders,
    overdueReminders,
    activeUsers,
  });
}

/**
 * GET /api/analytics/trend
 *
 * Real weekly lead/conversion counts, replacing the hardcoded `WEEK_DATA`
 * array the Analytics page was rendering as if it were live.
 */
export async function getTrend(req: Request, res: Response) {
  const { orgId } = auth(req);

  const weeks = 8;
  const today = startOfToday();
  // Align to the start of the week containing today, then walk back.
  const windowStart = addDays(today, -7 * (weeks - 1));

  const [created, won] = await Promise.all([
    prisma.lead.findMany({
      where: { orgId, createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.lead.findMany({
      where: { orgId, status: LeadStatus.Won, updatedAt: { gte: windowStart } },
      select: { updatedAt: true },
    }),
  ]);

  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(windowStart, i * 7);
    return {
      week: `Week ${i + 1}`,
      startDate: toDateString(start),
      start: start.getTime(),
      end: addDays(start, 7).getTime(),
      newLeads: 0,
      converted: 0,
    };
  });

  const place = (when: Date, key: 'newLeads' | 'converted') => {
    const t = when.getTime();
    const bucket = buckets.find((b) => t >= b.start && t < b.end);
    if (bucket) bucket[key] += 1;
  };

  created.forEach((l) => place(l.createdAt, 'newLeads'));
  won.forEach((l) => place(l.updatedAt, 'converted'));

  res.json({
    data: buckets.map(({ start: _s, end: _e, ...rest }) => rest),
  });
}

/**
 * GET /api/analytics/leaderboard
 *
 * Per-owner performance, aggregated in SQL.
 */
export async function getLeaderboard(req: Request, res: Response) {
  const { orgId } = auth(req);

  const [members, totals, wonTotals] = await Promise.all([
    prisma.user.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true, role: true, avatar: true },
    }),
    prisma.lead.groupBy({
      by: ['ownerId'],
      where: { orgId, ownerId: { not: null } },
      _count: { _all: true },
      _sum: { budgetLakhs: true },
      _avg: { aiScore: true },
    }),
    prisma.lead.groupBy({
      by: ['ownerId'],
      where: { orgId, ownerId: { not: null }, status: LeadStatus.Won },
      _count: { _all: true },
      _sum: { budgetLakhs: true },
    }),
  ]);

  const totalBy = new Map(totals.map((t) => [t.ownerId, t]));
  const wonBy = new Map(wonTotals.map((t) => [t.ownerId, t]));

  const rows = members
    .map((member) => {
      const total = totalBy.get(member.id);
      const won = wonBy.get(member.id);
      const leadCount = total?._count._all ?? 0;
      const wonCount = won?._count._all ?? 0;

      return {
        userId: member.id,
        name: member.name,
        role: member.role,
        avatar: member.avatar ?? undefined,
        leads: leadCount,
        won: wonCount,
        conversionRate: leadCount > 0 ? Math.round((wonCount / leadCount) * 100) : 0,
        pipelineLakhs: round2(total?._sum.budgetLakhs ?? 0),
        wonLakhs: round2(won?._sum.budgetLakhs ?? 0),
        avgAiScore: Math.round(total?._avg.aiScore ?? 0),
      };
    })
    .sort((a, b) => b.wonLakhs - a.wonLakhs || b.won - a.won);

  res.json({ data: rows.map((row, i) => ({ rank: i + 1, ...row })) });
}

const round2 = (n: number) => Math.round(n * 100) / 100;
