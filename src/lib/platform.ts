import { api } from './api';

/**
 * Client for the cross-tenant operator console.
 *
 * Kept apart from the tenant-facing store: none of this data belongs to the
 * signed-in user's own organisation, so it is fetched on demand by the console
 * pages rather than held in the app-wide store where a tenant page could read
 * it by accident.
 */

export type PlanTier = 'Trial' | 'Business' | 'Enterprise';
export type SubscriptionStatus = 'Trialing' | 'Active' | 'PastDue' | 'Canceled' | 'Suspended';

export interface PlatformOverview {
  tenants: {
    total: number;
    active: number;
    newLast30Days: number;
    byTier: Partial<Record<PlanTier, number>>;
    byStatus: Partial<Record<SubscriptionStatus, number>>;
  };
  seats: { total: number; active: number };
  records: { leads: number };
  usageLast30Days: {
    aiRequests: number;
    aiCostPaise: number;
    apiRequests: number;
    totalEvents: number;
  };
  revenue: { mrrPaise: number; arrPaise: number; currency: string };
  billing: { stripeConfigured: boolean };
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  subscription: {
    tier: PlanTier;
    status: SubscriptionStatus;
    seats: number;
    allowOverage: boolean;
    trialEndsAt: string | null;
    currentPeriodEnd: string;
    stripeLinked: boolean;
  } | null;
  counts: { users: number; leads: number; messages: number; documents: number };
  usage: Partial<Record<string, number>>;
  aiCostPaise: number;
}

export interface InvoiceLine {
  kind: string;
  description: string;
  quantity: number;
  unitPaise: number;
  amountPaise: number;
}

export interface TenantDetail {
  organization: { id: string; name: string; slug: string; createdAt: string };
  subscription: {
    id: string;
    tier: PlanTier;
    status: SubscriptionStatus;
    seats: number;
    allowOverage: boolean;
    limitOverrides: Record<string, number | null> | null;
    trialEndsAt: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    stripeCustomerId: string | null;
  } | null;
  limits: Record<string, number | null>;
  period: { start: string; end: string };
  usage: Partial<Record<string, { quantity: number; costPaise: number }>>;
  estimate: {
    lines: InvoiceLine[];
    subtotalPaise: number;
    overagePaise: number;
    totalPaise: number;
  };
  counts: Record<string, number>;
  users: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    lastLoginAt: string | null;
  }[];
  activity: { date: string; events: number; aiCostPaise: number }[];
  invoices: {
    id: string;
    periodStart: string;
    periodEnd: string;
    totalPaise: number;
    status: string;
    stripeInvoiceId: string | null;
  }[];
}

export interface Plan {
  tier: PlanTier;
  name: string;
  basePaise: number;
  perSeatPaise: number;
  limits: Record<string, number | null>;
  features: string[];
}

export const platformApi = {
  overview: () => api.get<PlatformOverview>('/platform/overview'),

  plans: () => api.get<{ data: Plan[] }>('/platform/plans').then((r) => r.data),

  tenants: (params: { search?: string; tier?: PlanTier; status?: SubscriptionStatus } = {}) =>
    api.get<{ data: TenantRow[]; nextCursor: string | null }>('/platform/tenants', {
      query: { limit: 100, ...params },
    }),

  tenant: (id: string) => api.get<TenantDetail>(`/platform/tenants/${id}`),

  updateSubscription: (
    id: string,
    patch: {
      tier?: PlanTier;
      status?: SubscriptionStatus;
      seats?: number;
      allowOverage?: boolean;
      limitOverrides?: Record<string, number | null> | null;
    }
  ) => api.put<{ subscription: TenantDetail['subscription'] }>(`/platform/tenants/${id}/subscription`, patch),

  linkStripe: (id: string) =>
    api.post<{ stripeCustomerId: string; created: boolean }>(`/platform/tenants/${id}/stripe-customer`),

  closePeriod: (id: string, pushToStripe: boolean) =>
    api.post<{ invoiceId: string; totalPaise: number; stripeInvoiceId?: string }>(
      `/platform/tenants/${id}/close-period`,
      { pushToStripe }
    ),

  rebuildCounters: (id: string) =>
    api.post<{ rebuilt: number }>(`/platform/tenants/${id}/rebuild-counters`),

  duePeriods: () =>
    api.get<{ data: { orgId: string }[]; count: number }>('/platform/billing-runs/due'),
};

/** Paise are integers on the wire; only format at the edge. */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  if (Math.abs(rupees) >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)} Cr`;
  if (Math.abs(rupees) >= 100_000) return `₹${(rupees / 100_000).toFixed(2)} L`;
  return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export const USAGE_LABELS: Record<string, string> = {
  ai_request: 'AI requests',
  api_request: 'API requests',
  lead_created: 'Leads created',
  message_sent: 'Messages sent',
  document_stored: 'Documents stored',
  workflow_run: 'Workflow runs',
  seat_active: 'Active seats',
};
