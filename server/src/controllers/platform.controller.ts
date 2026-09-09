import { PlanTier, SubscriptionStatus, UsageKind } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { buildInvoiceLines, closePeriod, findPeriodsDue } from '../billing/invoice.service';
import { PLAN_LIST, PLANS, resolveLimits } from '../billing/plans';
import { currentUsage, rebuildCounters } from '../billing/usage.service';
import { createCustomer, stripeConfigured } from '../billing/stripe.service';
import { validatedParams, validatedQuery } from '../middlewares/validate';
import { badRequest, notFound } from '../utils/httpError';
import type { IdParam } from '../schemas';

/**
 * Cross-tenant operator endpoints. Every handler here reads across
 * organisations by design, which is why the whole router sits behind
 * `requirePlatformAdmin`.
 */

/** GET /api/platform/overview — the fleet at a glance. */
export async function getOverview(_req: Request, res: Response) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    orgCount,
    activeOrgCount,
    userCount,
    activeUserCount,
    byTier,
    byStatus,
    leadTotal,
    aiUsage,
    apiUsage,
    newOrgs,
    recentEvents,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.subscription.count({
      where: { status: { in: [SubscriptionStatus.Active, SubscriptionStatus.Trialing] } },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.subscription.groupBy({ by: ['tier'], _count: { _all: true } }),
    prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lead.count(),
    prisma.usageEvent.aggregate({
      where: { kind: UsageKind.ai_request, occurredAt: { gte: thirtyDaysAgo } },
      _sum: { quantity: true, costPaise: true },
    }),
    prisma.usageEvent.aggregate({
      where: { kind: UsageKind.api_request, occurredAt: { gte: thirtyDaysAgo } },
      _sum: { quantity: true },
    }),
    prisma.organization.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.usageEvent.count({ where: { occurredAt: { gte: thirtyDaysAgo } } }),
  ]);

  // Monthly recurring revenue from plan base prices, in paise.
  const mrrPaise = byTier.reduce((sum, row) => sum + PLANS[row.tier].basePaise * row._count._all, 0);

  res.json({
    tenants: {
      total: orgCount,
      active: activeOrgCount,
      newLast30Days: newOrgs,
      byTier: Object.fromEntries(byTier.map((r) => [r.tier, r._count._all])),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
    },
    seats: { total: userCount, active: activeUserCount },
    records: { leads: leadTotal },
    usageLast30Days: {
      aiRequests: aiUsage._sum.quantity ?? 0,
      aiCostPaise: aiUsage._sum.costPaise ?? 0,
      apiRequests: apiUsage._sum.quantity ?? 0,
      totalEvents: recentEvents,
    },
    revenue: { mrrPaise, arrPaise: mrrPaise * 12, currency: 'INR' },
    billing: { stripeConfigured: stripeConfigured() },
  });
}

/** GET /api/platform/tenants — one row per customer, with live usage. */
export async function listTenants(req: Request, res: Response) {
  const { limit, cursor, tier, status, search } = validatedQuery<{
    limit: number;
    cursor?: string;
    tier?: PlanTier;
    status?: SubscriptionStatus;
    search?: string;
  }>(req);

  const orgs = await prisma.organization.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(tier || status
        ? { subscription: { ...(tier ? { tier } : {}), ...(status ? { status } : {}) } }
        : {}),
    },
    include: {
      subscription: true,
      _count: { select: { users: true, leads: true, messages: true, documents: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = orgs.length > limit;
  const page = hasMore ? orgs.slice(0, limit) : orgs;

  // Current-period usage per tenant, fetched in one query rather than N.
  const periodStarts = page
    .map((o) => o.subscription?.currentPeriodStart)
    .filter((d): d is Date => Boolean(d));

  const counters =
    periodStarts.length > 0
      ? await prisma.usageCounter.findMany({
          where: { orgId: { in: page.map((o) => o.id) }, periodStart: { in: periodStarts } },
        })
      : [];

  const data = page.map((org) => {
    const sub = org.subscription;
    const mine = counters.filter(
      (c) => c.orgId === org.id && c.periodStart.getTime() === sub?.currentPeriodStart.getTime()
    );
    const usage = Object.fromEntries(mine.map((c) => [c.kind, c.quantity]));
    const aiCost = mine.reduce((sum, c) => sum + c.costPaise, 0);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt.toISOString(),
      subscription: sub
        ? {
            tier: sub.tier,
            status: sub.status,
            seats: sub.seats,
            allowOverage: sub.allowOverage,
            trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
            currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
            stripeLinked: Boolean(sub.stripeCustomerId),
          }
        : null,
      counts: {
        users: org._count.users,
        leads: org._count.leads,
        messages: org._count.messages,
        documents: org._count.documents,
      },
      usage,
      aiCostPaise: aiCost,
    };
  });

  res.json({ data, nextCursor: hasMore ? page[page.length - 1]?.id : null });
}

/** GET /api/platform/tenants/:id — full detail for one customer. */
export async function getTenant(req: Request, res: Response) {
  const { id } = validatedParams<IdParam>(req);

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      subscription: { include: { invoices: { orderBy: { periodStart: 'desc' }, take: 12 } } },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
        },
        orderBy: { name: 'asc' },
      },
      _count: {
        select: {
          leads: true,
          messages: true,
          reminders: true,
          documents: true,
          workflows: true,
          apiKeys: true,
          mcpConnections: true,
        },
      },
    },
  });

  if (!org) throw notFound('Tenant not found');

  const usage = await currentUsage(org.id);
  const estimate = await buildInvoiceLines(org.id, usage.period.start, usage.period.end);

  // 30-day daily activity, for the sparkline in the detail view.
  const since = new Date(Date.now() - 30 * 86_400_000);
  const events = await prisma.usageEvent.findMany({
    where: { orgId: org.id, occurredAt: { gte: since } },
    select: { kind: true, quantity: true, costPaise: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
  });

  const daily = new Map<string, { date: string; events: number; aiCostPaise: number }>();
  for (const e of events) {
    const day = e.occurredAt.toISOString().slice(0, 10);
    const row = daily.get(day) ?? { date: day, events: 0, aiCostPaise: 0 };
    row.events += e.quantity;
    row.aiCostPaise += e.costPaise ?? 0;
    daily.set(day, row);
  }

  res.json({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt.toISOString(),
    },
    subscription: org.subscription,
    limits: usage.limits,
    period: {
      start: usage.period.start.toISOString(),
      end: usage.period.end.toISOString(),
    },
    usage: usage.byKind,
    estimate,
    counts: org._count,
    users: org.users.map((u) => ({
      ...u,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    })),
    activity: [...daily.values()],
    invoices: org.subscription?.invoices ?? [],
  });
}

/**
 * PUT /api/platform/tenants/:id/subscription
 *
 * The operator lever: move a customer between tiers, grant a limit exception,
 * enable overage, or suspend a non-paying workspace.
 */
export async function updateSubscription(req: Request, res: Response) {
  const { id } = validatedParams<IdParam>(req);
  const body = req.body as {
    tier?: PlanTier;
    status?: SubscriptionStatus;
    seats?: number;
    allowOverage?: boolean;
    limitOverrides?: Record<string, number | null> | null;
    trialEndsAt?: string | null;
  };

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, subscription: { select: { id: true } } },
  });
  if (!org) throw notFound('Tenant not found');
  if (!org.subscription) throw badRequest('This tenant has no subscription record yet');

  const updated = await prisma.subscription.update({
    where: { id: org.subscription.id },
    data: {
      ...(body.tier !== undefined ? { tier: body.tier } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.seats !== undefined ? { seats: body.seats } : {}),
      ...(body.allowOverage !== undefined ? { allowOverage: body.allowOverage } : {}),
      ...(body.limitOverrides !== undefined
        ? { limitOverrides: body.limitOverrides ?? undefined }
        : {}),
      ...(body.trialEndsAt !== undefined
        ? { trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : null }
        : {}),
      ...(body.status === SubscriptionStatus.Canceled ? { canceledAt: new Date() } : {}),
    },
  });

  res.json({
    subscription: updated,
    limits: resolveLimits(updated.tier, updated.limitOverrides),
  });
}

/** POST /api/platform/tenants/:id/stripe-customer — link a tenant to Stripe. */
export async function linkStripeCustomer(req: Request, res: Response) {
  const { id } = validatedParams<IdParam>(req);

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      subscription: true,
      users: {
        where: { role: 'Admin', isActive: true },
        select: { email: true },
        take: 1,
      },
    },
  });
  if (!org) throw notFound('Tenant not found');
  if (!org.subscription) throw badRequest('This tenant has no subscription record yet');
  if (org.subscription.stripeCustomerId) {
    return res.json({ stripeCustomerId: org.subscription.stripeCustomerId, created: false });
  }

  const billingEmail = org.users[0]?.email;
  if (!billingEmail) throw badRequest('Tenant has no active admin to bill');

  const customer = await createCustomer({
    orgId: org.id,
    name: org.name,
    email: billingEmail,
  });

  await prisma.subscription.update({
    where: { id: org.subscription.id },
    data: { stripeCustomerId: customer.id },
  });

  res.status(201).json({ stripeCustomerId: customer.id, created: true });
}

/** POST /api/platform/tenants/:id/close-period — invoice the current period. */
export async function closeTenantPeriod(req: Request, res: Response) {
  const { id } = validatedParams<IdParam>(req);
  const { pushToStripe } = req.body as { pushToStripe?: boolean };

  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true } });
  if (!org) throw notFound('Tenant not found');

  const result = await closePeriod(id, { pushToStripe: pushToStripe ?? false });
  if (!result) throw badRequest('This tenant has no subscription record yet');

  res.json(result);
}

/** GET /api/platform/billing-runs/due — periods ready to invoice. */
export async function listDuePeriods(_req: Request, res: Response) {
  const due = await findPeriodsDue();
  res.json({ data: due, count: due.length });
}

/** POST /api/platform/tenants/:id/rebuild-counters — repair metering rollups. */
export async function rebuildTenantCounters(req: Request, res: Response) {
  const { id } = validatedParams<IdParam>(req);
  const usage = await currentUsage(id);
  const kinds = await rebuildCounters(id, usage.period.start, usage.period.end);
  res.json({ rebuilt: kinds, period: usage.period });
}

/** GET /api/platform/plans — the plan catalogue the console renders. */
export function listPlans(_req: Request, res: Response) {
  res.json({ data: PLAN_LIST });
}
