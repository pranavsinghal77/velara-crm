import {
  PlanTier,
  Prisma,
  SubscriptionStatus,
  UsageKind,
  type Subscription,
} from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';
import { limitFor, overageRate, resolveLimits } from './plans';

/**
 * Metering.
 *
 * Every billable action calls `record`, which appends a UsageEvent and bumps
 * the matching UsageCounter in one transaction. The counter exists so that
 * `assertWithinLimit` is a single indexed read: checking a limit by aggregating
 * the event log would get slower for exactly the customers who use the product
 * most.
 */

export interface UsageContext {
  orgId: string;
  userId?: string;
  apiKeyId?: string;
}

/** The tenant's subscription, created lazily so no tenant is unmetered. */
export async function getSubscription(orgId: string): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({ where: { orgId } });
  if (existing) return existing;

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 86_400_000);

  return prisma.subscription.create({
    data: {
      orgId,
      tier: PlanTier.Trial,
      status: SubscriptionStatus.Trialing,
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
    },
  });
}

/**
 * Billing period containing `at`. Periods come from the subscription so they
 * line up with what the customer is actually invoiced for, rather than being
 * assumed to be calendar months.
 */
function periodOf(sub: Subscription, at = new Date()) {
  if (at >= sub.currentPeriodStart && at < sub.currentPeriodEnd) {
    return { start: sub.currentPeriodStart, end: sub.currentPeriodEnd };
  }

  // The period has rolled over but the renewal job has not run yet. Derive the
  // current window by stepping forward from the stored start.
  const lengthMs = sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime() || 30 * 86_400_000;
  const elapsed = at.getTime() - sub.currentPeriodStart.getTime();
  const periods = Math.floor(elapsed / lengthMs);
  const start = new Date(sub.currentPeriodStart.getTime() + periods * lengthMs);
  return { start, end: new Date(start.getTime() + lengthMs) };
}

export async function currentUsage(orgId: string) {
  const sub = await getSubscription(orgId);
  const { start, end } = periodOf(sub);

  const counters = await prisma.usageCounter.findMany({
    where: { orgId, periodStart: start },
  });

  const limits = resolveLimits(sub.tier, sub.limitOverrides);
  const byKind = Object.fromEntries(
    counters.map((c) => [c.kind, { quantity: c.quantity, costPaise: c.costPaise }])
  ) as Partial<Record<UsageKind, { quantity: number; costPaise: number }>>;

  return { subscription: sub, period: { start, end }, limits, byKind };
}

/**
 * Refuses the action when the tenant is out of allowance and overage is off.
 * Returns the remaining allowance so callers can surface a warning as it runs
 * low. 402 is used deliberately: it is a commercial refusal, not a permissions
 * problem, and the client shows an upgrade prompt rather than a login screen.
 */
export async function assertWithinLimit(
  orgId: string,
  kind: UsageKind,
  quantity = 1
): Promise<{ remaining: number | null; overage: boolean }> {
  const { subscription, limits, byKind, period } = await currentUsage(orgId);

  if (
    subscription.status === SubscriptionStatus.Suspended ||
    subscription.status === SubscriptionStatus.Canceled
  ) {
    throw new HttpError(
      402,
      'This workspace is not active. Please contact your administrator.',
      'subscription_inactive'
    );
  }

  const limit = limitFor(limits, kind);
  if (limit === null) return { remaining: null, overage: false };

  const used = byKind[kind]?.quantity ?? 0;
  const remaining = limit - used;

  if (remaining >= quantity) return { remaining: remaining - quantity, overage: false };

  if (subscription.allowOverage && overageRate(subscription.tier, kind) > 0) {
    return { remaining: 0, overage: true };
  }

  throw new HttpError(
    402,
    `Your plan includes ${limit.toLocaleString('en-IN')} ${labelFor(kind)} per billing period ` +
      `and this period is used up (resets ${period.end.toISOString().slice(0, 10)}). ` +
      `Upgrade your plan or enable overage billing to continue.`,
    'usage_limit_reached',
    { kind, limit, used, periodEnd: period.end }
  );
}

/**
 * Appends the event and bumps the counter atomically. Metering must never take
 * the request down with it, so a failure here is logged and swallowed: losing
 * one usage row is better than failing a customer action that already
 * succeeded.
 */
export async function record(
  ctx: UsageContext,
  kind: UsageKind,
  options: { quantity?: number; costPaise?: number; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  const { quantity = 1, costPaise = 0, metadata } = options;

  try {
    const sub = await getSubscription(ctx.orgId);
    const { start, end } = periodOf(sub);

    await prisma.$transaction([
      prisma.usageEvent.create({
        data: {
          orgId: ctx.orgId,
          kind,
          quantity,
          costPaise: costPaise || null,
          // Cast is needed because Prisma's Json input type does not accept a
          // bare Record; the value is plain JSON by construction.
          metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          userId: ctx.userId ?? null,
          apiKeyId: ctx.apiKeyId ?? null,
        },
      }),
      prisma.usageCounter.upsert({
        where: { orgId_kind_periodStart: { orgId: ctx.orgId, kind, periodStart: start } },
        create: {
          orgId: ctx.orgId,
          kind,
          periodStart: start,
          periodEnd: end,
          quantity,
          costPaise,
        },
        update: {
          quantity: { increment: quantity },
          costPaise: { increment: costPaise },
        },
      }),
    ]);
  } catch (err) {
    logger.error('Failed to record usage', {
      orgId: ctx.orgId,
      kind,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Check then record, for the common "do one metered thing" case. */
export async function consume(
  ctx: UsageContext,
  kind: UsageKind,
  options: { quantity?: number; costPaise?: number; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  await assertWithinLimit(ctx.orgId, kind, options.quantity ?? 1);
  await record(ctx, kind, options);
}

/**
 * Rebuilds counters for a period from the event log. The counters are a cache;
 * this is how they get repaired if a transaction was lost or a period boundary
 * moved.
 */
export async function rebuildCounters(orgId: string, start: Date, end: Date): Promise<number> {
  const grouped = await prisma.usageEvent.groupBy({
    by: ['kind'],
    where: { orgId, occurredAt: { gte: start, lt: end } },
    _sum: { quantity: true, costPaise: true },
  });

  for (const row of grouped) {
    await prisma.usageCounter.upsert({
      where: { orgId_kind_periodStart: { orgId, kind: row.kind, periodStart: start } },
      create: {
        orgId,
        kind: row.kind,
        periodStart: start,
        periodEnd: end,
        quantity: row._sum.quantity ?? 0,
        costPaise: row._sum.costPaise ?? 0,
      },
      update: {
        quantity: row._sum.quantity ?? 0,
        costPaise: row._sum.costPaise ?? 0,
      },
    });
  }

  return grouped.length;
}

function labelFor(kind: UsageKind): string {
  switch (kind) {
    case UsageKind.ai_request:
      return 'AI requests';
    case UsageKind.api_request:
      return 'API requests';
    case UsageKind.lead_created:
      return 'new leads';
    case UsageKind.message_sent:
      return 'messages';
    case UsageKind.document_stored:
      return 'stored documents';
    case UsageKind.workflow_run:
      return 'workflow runs';
    case UsageKind.seat_active:
      return 'seats';
    default:
      return kind;
  }
}
