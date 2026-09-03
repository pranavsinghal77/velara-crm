import crypto from 'crypto';
import { env } from '../config/env';
import { HttpError, serviceUnavailable } from '../utils/httpError';
import { logger } from '../utils/logger';

/**
 * Stripe access over the REST API.
 *
 * Deliberately no SDK: the surface we need is four endpoints, and a direct
 * `fetch` keeps the dependency tree (and its supply-chain risk) smaller. It
 * also means billing code runs unchanged whether or not a key is configured —
 * every call checks first and fails with a clear 503 rather than throwing
 * something opaque from inside a library.
 *
 * Nothing here is exercised until STRIPE_SECRET_KEY is set. Metering, plan
 * limits and overage calculation all work without it; Stripe only turns local
 * invoices into real charges.
 */

const TIMEOUT_MS = 15_000;

export const stripeConfigured = () => env.billingEnabled;

function assertConfigured(): string {
  if (!env.STRIPE_SECRET_KEY) {
    throw serviceUnavailable(
      'Stripe is not configured on this server. Set STRIPE_SECRET_KEY to enable billing.'
    );
  }
  return env.STRIPE_SECRET_KEY;
}

/**
 * Stripe takes form-encoded bodies with bracket notation for nested values.
 */
function encodeForm(data: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];

  for (const [rawKey, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const key = prefix ? `${prefix}[${rawKey}]` : rawKey;

    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(encodeForm(value as Record<string, unknown>, key));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) {
          parts.push(encodeForm(item as Record<string, unknown>, `${key}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.filter(Boolean).join('&');
}

async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  /** Makes a retried POST idempotent on Stripe's side. */
  idempotencyKey?: string
): Promise<T> {
  const secret = assertConfigured();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    'Stripe-Version': '2024-06-20',
  };
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${env.STRIPE_API_BASE}/v1${path}`, {
      method,
      headers,
      body: body ? encodeForm(body) : undefined,
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => null)) as
      | { error?: { message?: string; code?: string } }
      | null;

    if (!res.ok) {
      const message = payload?.error?.message ?? `Stripe request failed (${res.status})`;
      logger.error('Stripe API error', { path, status: res.status, code: payload?.error?.code });
      // 4xx from Stripe is usually our bad request; 5xx is theirs.
      throw new HttpError(res.status >= 500 ? 502 : 400, message, 'stripe_error');
    }

    return payload as T;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw serviceUnavailable('Stripe did not respond in time.');
    }
    throw serviceUnavailable('Could not reach Stripe.');
  } finally {
    clearTimeout(timer);
  }
}

// --- Operations we actually use ---------------------------------------------

export interface StripeCustomer {
  id: string;
  email?: string;
}

export function createCustomer(input: {
  orgId: string;
  name: string;
  email: string;
}): Promise<StripeCustomer> {
  return call<StripeCustomer>(
    'POST',
    '/customers',
    {
      name: input.name,
      email: input.email,
      // Lets a Stripe-side event be traced back to a tenant.
      metadata: { orgId: input.orgId },
    },
    `customer:${input.orgId}`
  );
}

export interface StripeInvoice {
  id: string;
  status: string;
  hosted_invoice_url?: string;
  total: number;
}

/**
 * Pushes one billing period onto Stripe as an invoice with explicit line
 * items, then finalises it. Metered lines are sent as one-off invoice items so
 * the amounts always match what we computed locally, rather than relying on
 * Stripe-side usage records staying in sync with ours.
 */
export async function pushInvoice(input: {
  customerId: string;
  currency: string;
  description: string;
  lines: { description: string; amountPaise: number }[];
  idempotencyKey: string;
}): Promise<StripeInvoice> {
  for (const [i, line] of input.lines.entries()) {
    if (line.amountPaise <= 0) continue;
    await call(
      'POST',
      '/invoiceitems',
      {
        customer: input.customerId,
        amount: line.amountPaise,
        currency: input.currency.toLowerCase(),
        description: line.description,
      },
      `${input.idempotencyKey}:item:${i}`
    );
  }

  const invoice = await call<StripeInvoice>(
    'POST',
    '/invoices',
    {
      customer: input.customerId,
      description: input.description,
      collection_method: 'send_invoice',
      days_until_due: 7,
      auto_advance: false,
    },
    `${input.idempotencyKey}:invoice`
  );

  return call<StripeInvoice>(
    'POST',
    `/invoices/${invoice.id}/finalize`,
    {},
    `${input.idempotencyKey}:finalize`
  );
}

export function getSubscription(id: string) {
  return call<{ id: string; status: string; current_period_end: number }>(
    'GET',
    `/subscriptions/${id}`
  );
}

// --- Webhook verification ----------------------------------------------------

/**
 * Verifies Stripe's `Stripe-Signature` header against the raw request body.
 *
 * This must run on the *raw* bytes: JSON.parse then re-stringify changes
 * whitespace and key order, and the signature no longer matches. The webhook
 * route therefore mounts `express.raw()` ahead of the JSON parser.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  toleranceSeconds = 300
): void {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw serviceUnavailable('STRIPE_WEBHOOK_SECRET is not configured.');
  }
  if (!signatureHeader) {
    throw new HttpError(400, 'Missing Stripe-Signature header', 'signature_missing');
  }

  const parts = signatureHeader.split(',').reduce<Record<string, string[]>>((acc, piece) => {
    const [k, v] = piece.split('=');
    if (!k || !v) return acc;
    (acc[k] ??= []).push(v);
    return acc;
  }, {});

  const timestamp = parts.t?.[0];
  const signatures = parts.v1 ?? [];

  if (!timestamp || signatures.length === 0) {
    throw new HttpError(400, 'Malformed Stripe-Signature header', 'signature_malformed');
  }

  // Reject stale signatures so a captured request cannot be replayed later.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) {
    throw new HttpError(400, 'Stripe signature timestamp outside tolerance', 'signature_stale');
  }

  const expected = crypto
    .createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const matched = signatures.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, 'hex');
    // timingSafeEqual throws on a length mismatch, so guard first.
    return (
      candidateBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, expectedBuf)
    );
  });

  if (!matched) {
    throw new HttpError(400, 'Stripe signature verification failed', 'signature_invalid');
  }
}
