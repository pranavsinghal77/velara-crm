import { PlanTier, SubscriptionStatus, UsageKind, type Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';
import { PLANS, formatPaise, limitFor, overageRate, resolveLimits } from './plans';
import { pushInvoice, stripeConfigured } from './stripe.service';

/**
 * Turns a tenant's metered period into an invoice.
 *
 * Everything is computed locally first and stored as an Invoice row with its
 * line items. Stripe, if configured, receives those exact amounts. The local
 * row is the record of truth, so a Stripe outage delays delivery of a bill
 * rather than losing it.
 */

export interface InvoiceLine {
  kind: string;
  description: string;
  quantity: number;
  unitPaise: number;
  amountPaise: number;
}

const METERED: UsageKind[] = [
  UsageKind.ai_request,
  UsageKind.api_request,
  UsageKind.document_stored,
  UsageKind.workflow_run,
];

/**
 * Builds (but does not persist) the lines for one period, so the platform
 * console can show a live "current period estimate" before the period closes.
 */
export async function buildInvoiceLines(
  orgId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ lines: InvoiceLine[]; subtotalPaise: number; overagePaise: number; totalPaise: number }> {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub) return { lines: [], subtotalPaise: 0, overagePaise: 0, totalPaise: 0 };

  const plan = PLANS[sub.tier];
  const limits = resolveLimits(sub.tier, sub.limitOverrides);
  const lines: InvoiceLine[] = [];

  // 1. Base subscription.
  if (plan.basePaise > 0) {
    lines.push({
      kind: 'base',
      description: `${plan.name} plan`,
      quantity: 1,
      unitPaise: plan.basePaise,
      amountPaise: plan.basePaise,
    });
  }

  // 2. Seats beyond the plan allowance.
  const activeSeats = await prisma.user.count({ where: { orgId, isActive: true } });
  const includedSeats = limits.seats;
  if (includedSeats !== null && plan.perSeatPaise > 0 && activeSeats > includedSeats) {
    const extra = activeSeats - includedSeats;
    lines.push({
      kind: 'seats',
      description: `${extra} additional seat${extra > 1 ? 's' : ''} (${activeSeats} active, ${includedSeats} included)`,
      quantity: extra,
      unitPaise: plan.perSeatPaise,
      amountPaise: extra * plan.perSeatPaise,
    });
  }

  // 3. Metered overage.
  const counters = await prisma.usageCounter.findMany({
    // Both bounds, so a counter left behind by a shifted period boundary
    // cannot be billed against this one on a periodStart match alone.
    where: { orgId, periodStart, periodEnd },
  });

  let overagePaise = 0;

  for (const kind of METERED) {
    const counter = counters.find((c) => c.kind === kind);
    if (!counter || counter.quantity === 0) continue;

    const included = limitFor(limits, kind);
    if (included === null) continue; // unlimited on this plan

    const excess = counter.quantity - included;
    if (excess <= 0) continue;

    const rate = overageRate(sub.tier, kind);
    if (rate <= 0) continue; // plan blocks rather than bills

    const amount = excess * rate;
    overagePaise += amount;

    lines.push({
      kind,
      description: `${kind.replace(/_/g, ' ')} overage: ${excess.toLocaleString('en-IN')} beyond ${included.toLocaleString('en-IN')} included`,
      quantity: excess,
      unitPaise: rate,
      amountPaise: amount,
    });
  }

  const subtotalPaise = lines
    .filter((l) => l.kind === 'base' || l.kind === 'seats')
    .reduce((sum, l) => sum + l.amountPaise, 0);

  return {
    lines,
    subtotalPaise,
    overagePaise,
    totalPaise: subtotalPaise + overagePaise,
  };
}

/**
 * Closes a period: writes the Invoice, rolls the subscription forward, and
 * pushes to Stripe when configured. Idempotent per (org, periodStart) so a
 * retried billing run does not double-charge.
 */
export async function closePeriod(
  orgId: string,
  options: { pushToStripe?: boolean } = {}
): Promise<{ invoiceId: string; totalPaise: number; stripeInvoiceId?: string } | null> {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub) return null;

  const periodStart = sub.currentPeriodStart;
  const periodEnd = sub.currentPeriodEnd;

  const existing = await prisma.invoice.findFirst({
    where: { orgId, periodStart },
  });
  if (existing) {
    logger.info('Period already invoiced, skipping', { orgId, periodStart });
    return { invoiceId: existing.id, totalPaise: existing.totalPaise };
  }

  const { lines, subtotalPaise, overagePaise, totalPaise } = await buildInvoiceLines(
    orgId,
    periodStart,
    periodEnd
  );

  const invoice = await prisma.invoice.create({
    data: {
      subscriptionId: sub.id,
      orgId,
      periodStart,
      periodEnd,
      subtotalPaise,
      overagePaise,
      totalPaise,
      lineItems: lines as unknown as Prisma.InputJsonValue,
      status: totalPaise === 0 ? 'zero' : 'draft',
      issuedAt: new Date(),
    },
  });

  // Advance the period so metering starts a fresh window.
  const lengthMs = periodEnd.getTime() - periodStart.getTime() || 30 * 86_400_000;
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      currentPeriodStart: periodEnd,
      currentPeriodEnd: new Date(periodEnd.getTime() + lengthMs),
      // A trial that reaches its end becomes past-due rather than silently
      // continuing to serve an unpaid workspace.
      status:
        sub.status === SubscriptionStatus.Trialing && sub.tier === PlanTier.Trial
          ? SubscriptionStatus.PastDue
          : sub.status,
    },
  });

  if (options.pushToStripe && stripeConfigured() && sub.stripeCustomerId && totalPaise > 0) {
    try {
      const stripeInvoice = await pushInvoice({
        customerId: sub.stripeCustomerId,
        currency: invoice.currency,
        description: `Velara CRM — ${periodStart.toISOString().slice(0, 10)} to ${periodEnd
          .toISOString()
          .slice(0, 10)}`,
        lines: lines.map((l) => ({ description: l.description, amountPaise: l.amountPaise })),
        idempotencyKey: `inv:${invoice.id}`,
      });

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { stripeInvoiceId: stripeInvoice.id, status: stripeInvoice.status },
      });

      logger.info('Invoice pushed to Stripe', {
        orgId,
        invoiceId: invoice.id,
        total: formatPaise(totalPaise),
      });

      return { invoiceId: invoice.id, totalPaise, stripeInvoiceId: stripeInvoice.id };
    } catch (err) {
      // The local invoice stands; delivery can be retried.
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'delivery_failed' },
      });
      logger.error('Stripe invoice push failed', {
        orgId,
        invoiceId: invoice.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { invoiceId: invoice.id, totalPaise };
}

/** Every subscription whose period has ended and has not been invoiced yet. */
export async function findPeriodsDue(now = new Date()) {
  return prisma.subscription.findMany({
    where: {
      currentPeriodEnd: { lte: now },
      status: { notIn: [SubscriptionStatus.Canceled] },
    },
    select: { orgId: true, currentPeriodStart: true, currentPeriodEnd: true },
  });
}
