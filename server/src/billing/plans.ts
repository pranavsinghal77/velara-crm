import { PlanTier, UsageKind } from '@prisma/client';

/**
 * Commercial plan definitions.
 *
 * These live in code rather than the database so a pricing change is a
 * reviewable diff instead of a production UPDATE. Per-tenant exceptions go in
 * `Subscription.limitOverrides`, which is how you give one customer a higher
 * ceiling without inventing a new tier.
 *
 * All money is in paise (1 INR = 100 paise) and held as integers. Floating
 * point currency is how rounding bugs get into invoices.
 */

export interface PlanLimits {
  /** Null means unlimited. */
  seats: number | null;
  ai_request: number | null;
  api_request: number | null;
  lead_created: number | null;
  message_sent: number | null;
  document_stored: number | null;
  workflow_run: number | null;
}

export interface Plan {
  tier: PlanTier;
  name: string;
  /** Recurring price per period, in paise. */
  basePaise: number;
  /** Price per additional seat beyond the plan allowance, in paise. */
  perSeatPaise: number;
  limits: PlanLimits;
  /** Charged per unit once the included allowance is exhausted, in paise. */
  overagePaise: Partial<Record<UsageKind, number>>;
  features: string[];
}

const UNLIMITED = null;

export const PLANS: Record<PlanTier, Plan> = {
  [PlanTier.Trial]: {
    tier: PlanTier.Trial,
    name: 'Trial',
    basePaise: 0,
    perSeatPaise: 0,
    limits: {
      seats: 3,
      ai_request: 100,
      api_request: 1_000,
      lead_created: 100,
      message_sent: 500,
      document_stored: 20,
      workflow_run: 50,
    },
    // A trial never bills; it stops instead.
    overagePaise: {},
    features: ['Core CRM', 'AI assistant (capped)', '14-day evaluation'],
  },

  [PlanTier.Business]: {
    tier: PlanTier.Business,
    name: 'Business',
    // Rs 15,000/month, matching the published price.
    basePaise: 15_000_00,
    perSeatPaise: 300_00,
    limits: {
      seats: 50,
      ai_request: 10_000,
      api_request: 500_000,
      lead_created: UNLIMITED,
      message_sent: UNLIMITED,
      document_stored: 5_000,
      workflow_run: 10_000,
    },
    overagePaise: {
      [UsageKind.ai_request]: 50,
      [UsageKind.api_request]: 1,
      [UsageKind.document_stored]: 200,
      [UsageKind.workflow_run]: 10,
    },
    features: [
      'Core CRM',
      'AI assistant',
      'WhatsApp & omnichannel inbox',
      'API access',
      'Workflow automation',
    ],
  },

  [PlanTier.Enterprise]: {
    tier: PlanTier.Enterprise,
    name: 'Enterprise',
    // Custom; the floor of the published Rs 3L-6L/yr band, per month.
    basePaise: 25_000_00,
    perSeatPaise: 0,
    limits: {
      seats: UNLIMITED,
      ai_request: 100_000,
      api_request: UNLIMITED,
      lead_created: UNLIMITED,
      message_sent: UNLIMITED,
      document_stored: UNLIMITED,
      workflow_run: UNLIMITED,
    },
    overagePaise: {
      [UsageKind.ai_request]: 30,
    },
    features: [
      'Everything in Business',
      'Unlimited seats',
      'MCP connections',
      'Bring-your-own AI keys',
      '15-minute critical SLA',
      'Dedicated account manager',
    ],
  },
};

export const PLAN_LIST = Object.values(PLANS);

/** Limits for a tenant, with its overrides applied on top of the plan. */
export function resolveLimits(tier: PlanTier, overrides: unknown): PlanLimits {
  const base = { ...PLANS[tier].limits };

  if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
    for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
      if (!(key in base)) continue;
      // An explicit null in the overrides means "lift the cap entirely".
      if (value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
        (base as Record<string, number | null>)[key] = value as number | null;
      }
    }
  }

  return base;
}

export function limitFor(limits: PlanLimits, kind: UsageKind): number | null {
  // seat_active is checked against `seats`, not a same-named limit.
  if (kind === UsageKind.seat_active) return limits.seats;
  const value = (limits as unknown as Record<string, number | null>)[kind];
  return value === undefined ? null : value;
}

export function overageRate(tier: PlanTier, kind: UsageKind): number {
  return PLANS[tier].overagePaise[kind] ?? 0;
}

export const formatPaise = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
