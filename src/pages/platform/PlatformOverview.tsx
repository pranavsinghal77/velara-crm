import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CreditCard,
  Cpu,
  IndianRupee,
  Plug,
  Users,
} from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  formatPaise,
  platformApi,
  type PlatformOverview as Overview,
  type TenantRow,
} from '../../lib/platform';

/**
 * Operator home: the fleet at a glance.
 *
 * Every figure here comes from a database aggregate or the metering tables.
 * There are no illustrative numbers — an empty install shows zeros.
 */
export default function PlatformOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [due, setDue] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const [ov, list, dueRes] = await Promise.all([
          platformApi.overview(),
          platformApi.tenants(),
          platformApi.duePeriods(),
        ]);
        if (ignore) return;
        setOverview(ov);
        setTenants(list.data);
        setDue(dueRes.count);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof ApiError ? err.message : 'Could not load the platform overview.');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        {error || 'No data.'}
      </div>
    );
  }

  const { tenants: t, seats, usageLast30Days: usage, revenue, billing } = overview;

  // Ordered by current-period spend so the accounts that matter surface first.
  const topByUsage = [...tenants]
    .sort((a, b) => (b.usage.ai_request ?? 0) - (a.usage.ai_request ?? 0))
    .slice(0, 6);

  const atRisk = tenants.filter(
    (x) => x.subscription?.status === 'PastDue' || x.subscription?.status === 'Suspended'
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Platform overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Across all {t.total} customer workspace{t.total === 1 ? '' : 's'}.
        </p>
      </header>

      {!billing.stripeConfigured && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Stripe is not configured on this server, so invoices are computed and stored but not
            charged. Set <code className="bg-white px-1 rounded">STRIPE_SECRET_KEY</code> to enable
            collection.
          </p>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={IndianRupee}
          tone="text-emerald-600 bg-emerald-50"
          label="Monthly recurring revenue"
          value={formatPaise(revenue.mrrPaise)}
          sub={`${formatPaise(revenue.arrPaise)} annualised`}
        />
        <Kpi
          icon={Building2}
          tone="text-blue-600 bg-blue-50"
          label="Active workspaces"
          value={String(t.active)}
          sub={`${t.newLast30Days} new in 30 days`}
        />
        <Kpi
          icon={Users}
          tone="text-purple-600 bg-purple-50"
          label="Seats in use"
          value={String(seats.active)}
          sub={`of ${seats.total} provisioned`}
        />
        <Kpi
          icon={Cpu}
          tone="text-orange-600 bg-orange-50"
          label="AI requests (30d)"
          value={usage.aiRequests.toLocaleString('en-IN')}
          sub={`${formatPaise(usage.aiCostPaise)} attributed cost`}
        />
      </div>

      {/* Plan mix + operational attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Plan mix</h2>
          {Object.keys(t.byTier).length === 0 ? (
            <p className="text-xs text-slate-400">No subscriptions yet.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(t.byTier).map(([tier, count]) => (
                <li key={tier} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{tier}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Subscription status</h2>
          {Object.keys(t.byStatus).length === 0 ? (
            <p className="text-xs text-slate-400">No subscriptions yet.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(t.byStatus).map(([status, count]) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{status}</span>
                  <span
                    className={`font-semibold ${
                      status === 'PastDue' || status === 'Suspended'
                        ? 'text-red-600'
                        : 'text-slate-900'
                    }`}
                  >
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Needs attention</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-slate-700">Periods ready to invoice</span>
              <span className="font-semibold text-slate-900">{due}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-700">Past due or suspended</span>
              <span className={`font-semibold ${atRisk.length ? 'text-red-600' : 'text-slate-900'}`}>
                {atRisk.length}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-700">API requests (30d)</span>
              <span className="font-semibold text-slate-900">
                {usage.apiRequests.toLocaleString('en-IN')}
              </span>
            </li>
          </ul>
          {due > 0 && (
            <p className="mt-3 text-[11px] text-slate-500">
              Run <code className="bg-slate-100 px-1 rounded">npm run billing:run -- --commit</code>{' '}
              to issue them, or close a single period from its tenant page.
            </p>
          )}
        </section>
      </div>

      {/* Heaviest consumers */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Plug className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900">Resource use by workspace</h2>
          <span className="text-[11px] text-slate-400 ml-auto">current billing period</span>
        </div>

        {topByUsage.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-400">No workspaces yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
                  <th className="px-5 py-2 font-medium">Workspace</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium text-right">Seats</th>
                  <th className="px-3 py-2 font-medium text-right">Leads</th>
                  <th className="px-3 py-2 font-medium text-right">AI</th>
                  <th className="px-3 py-2 font-medium text-right">API</th>
                  <th className="px-5 py-2 font-medium text-right">AI cost</th>
                </tr>
              </thead>
              <tbody>
                {topByUsage.map((row) => (
                  <tr key={row.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <Link
                        to={`/platform/tenants/${row.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {row.subscription?.tier ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{row.counts.users}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{row.counts.leads}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {(row.usage.ai_request ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {(row.usage.api_request ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-2.5 text-right font-medium text-slate-900">
                      {formatPaise(row.aiCostPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-slate-100">
          <Link to="/platform/tenants" className="text-xs font-semibold text-blue-700 hover:underline">
            View all workspaces →
          </Link>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: typeof CreditCard;
  tone: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
