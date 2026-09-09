import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, RefreshCw } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  USAGE_LABELS,
  formatPaise,
  platformApi,
  type PlanTier,
  type SubscriptionStatus,
  type TenantDetail as Detail,
} from '../../lib/platform';

const TIERS: PlanTier[] = ['Trial', 'Business', 'Enterprise'];
const STATUSES: SubscriptionStatus[] = [
  'Trialing',
  'Active',
  'PastDue',
  'Canceled',
  'Suspended',
];

/**
 * One customer: what they are on, what they have used, what they owe, and the
 * levers to change it. Every action here writes through the platform API and
 * refetches, so the page never shows an optimistic state that the server
 * rejected.
 */
export default function TenantDetail() {
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await platformApi.tenant(id));
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this workspace.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(label: string, fn: () => Promise<string>) {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      setNotice(await fn());
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        {error || 'Workspace not found.'}
      </div>
    );
  }

  const { organization, subscription, limits, period, usage, estimate, counts, users, invoices } =
    detail;

  return (
    <div className="space-y-5">
      <Link
        to="/platform/tenants"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> All workspaces
      </Link>

      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{organization.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {organization.slug} · created{' '}
            {new Date(organization.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Period {period.start.slice(0, 10)} → {period.end.slice(0, 10)}
        </p>
      </header>

      {notice && (
        <div role="status" className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Subscription controls */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Subscription</h2>

          {!subscription ? (
            <p className="text-xs text-slate-400">This workspace has no subscription record.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  Plan
                </span>
                <select
                  value={subscription.tier}
                  disabled={busy !== null}
                  onChange={(e) =>
                    void act('Plan change', async () => {
                      await platformApi.updateSubscription(id, {
                        tier: e.target.value as PlanTier,
                      });
                      return `Moved to the ${e.target.value} plan.`;
                    })
                  }
                  className="mt-1 w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 disabled:opacity-60"
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  Status
                </span>
                <select
                  value={subscription.status}
                  disabled={busy !== null}
                  onChange={(e) =>
                    void act('Status change', async () => {
                      await platformApi.updateSubscription(id, {
                        status: e.target.value as SubscriptionStatus,
                      });
                      return `Status set to ${e.target.value}.`;
                    })
                  }
                  className="mt-1 w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 disabled:opacity-60"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  Seats
                </span>
                <input
                  type="number"
                  min={1}
                  defaultValue={subscription.seats}
                  disabled={busy !== null}
                  onBlur={(e) => {
                    const seats = Number(e.target.value);
                    if (!Number.isFinite(seats) || seats === subscription.seats || seats < 1) return;
                    void act('Seat change', async () => {
                      await platformApi.updateSubscription(id, { seats });
                      return `Seat allowance set to ${seats}.`;
                    });
                  }}
                  className="mt-1 w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 disabled:opacity-60"
                />
              </label>

              <label className="flex items-start gap-2 mt-5">
                <input
                  type="checkbox"
                  checked={subscription.allowOverage}
                  disabled={busy !== null}
                  onChange={(e) =>
                    void act('Overage change', async () => {
                      await platformApi.updateSubscription(id, { allowOverage: e.target.checked });
                      return e.target.checked
                        ? 'Overage billing enabled: usage past the plan limit is billed instead of blocked.'
                        : 'Overage billing disabled: usage past the plan limit is now refused.';
                    })
                  }
                  className="mt-0.5 accent-blue-600"
                />
                <span className="text-xs text-slate-700">
                  Allow overage
                  <span className="block text-[11px] text-slate-400">
                    Bill beyond plan limits rather than refusing the request.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-100">
            <button
              disabled={busy !== null || !subscription}
              onClick={() =>
                void act('Stripe link', async () => {
                  const r = await platformApi.linkStripe(id);
                  return r.created
                    ? `Stripe customer created (${r.stripeCustomerId}).`
                    : `Already linked to ${r.stripeCustomerId}.`;
                })
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {subscription?.stripeCustomerId ? 'Stripe linked' : 'Link Stripe customer'}
            </button>

            <button
              disabled={busy !== null || !subscription}
              onClick={() =>
                void act('Close period', async () => {
                  const r = await platformApi.closePeriod(id, false);
                  return `Period invoiced: ${formatPaise(r.totalPaise)} (invoice ${r.invoiceId}).`;
                })
              }
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              Close period &amp; invoice
            </button>

            <button
              disabled={busy !== null}
              onClick={() =>
                void act('Rebuild counters', async () => {
                  const r = await platformApi.rebuildCounters(id);
                  return `Rebuilt ${r.rebuilt} usage counter(s) from the event log.`;
                })
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Rebuild counters
            </button>
          </div>
        </section>

        {/* Current period estimate */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-1">This period</h2>
          <p className="text-[11px] text-slate-400 mb-3">Computed from recorded usage.</p>

          <p className="text-2xl font-bold text-slate-900">{formatPaise(estimate.totalPaise)}</p>
          {estimate.overagePaise > 0 && (
            <p className="text-[11px] text-amber-700 mt-0.5">
              includes {formatPaise(estimate.overagePaise)} overage
            </p>
          )}

          <ul className="mt-4 space-y-2">
            {estimate.lines.length === 0 ? (
              <li className="text-xs text-slate-400">Nothing billable yet.</li>
            ) : (
              estimate.lines.map((line) => (
                <li key={line.description} className="text-xs flex justify-between gap-2">
                  <span className="text-slate-600">{line.description}</span>
                  <span className="font-medium text-slate-900 shrink-0">
                    {formatPaise(line.amountPaise)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {/* Usage against limits */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Resource use against plan limits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.keys(USAGE_LABELS)
            .filter((kind) => kind !== 'seat_active')
            .map((kind) => {
              const used = usage[kind]?.quantity ?? 0;
              const limit = limits[kind];
              const pct = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
              const over = limit !== null && limit !== undefined && used > limit;

              return (
                <div key={kind}>
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="text-slate-600">{USAGE_LABELS[kind]}</span>
                    <span className={`font-semibold ${over ? 'text-amber-700' : 'text-slate-900'}`}>
                      {used.toLocaleString('en-IN')}
                      <span className="text-slate-400 font-normal">
                        {' / '}
                        {limit === null || limit === undefined ? 'unlimited' : limit.toLocaleString('en-IN')}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        over ? 'bg-amber-500' : pct > 80 ? 'bg-orange-400' : 'bg-blue-500'
                      }`}
                      style={{ width: `${limit === null || limit === undefined ? 0 : pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Seats */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Seats</h2>
            <span className="text-[11px] text-slate-400">
              {users.filter((u) => u.isActive).length} active of {users.length}
            </span>
          </div>
          <ul className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {users.map((u) => (
              <li key={u.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-semibold text-slate-600">{u.role}</p>
                  <p className="text-[10px] text-slate-400">
                    {u.lastLoginAt
                      ? `seen ${new Date(u.lastLoginAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                      : 'never signed in'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Records + invoices */}
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Stored records</h2>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              {Object.entries(counts).map(([key, value]) => (
                <div key={key} className="flex justify-between pr-4">
                  <span className="text-slate-600 capitalize">{key}</span>
                  <span className="font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Invoices</h2>
            </div>
            {invoices.length === 0 ? (
              <p className="px-5 py-6 text-xs text-slate-400">No invoices issued yet.</p>
            ) : (
              <ul className="divide-y divide-slate-50">
                {invoices.map((inv) => (
                  <li key={inv.id} className="px-5 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      {inv.periodStart.slice(0, 10)} → {inv.periodEnd.slice(0, 10)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {inv.status}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatPaise(inv.totalPaise)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
