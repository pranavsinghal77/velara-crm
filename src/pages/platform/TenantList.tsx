import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  formatPaise,
  platformApi,
  type PlanTier,
  type SubscriptionStatus,
  type TenantRow,
} from '../../lib/platform';

const TIERS: (PlanTier | 'All')[] = ['All', 'Trial', 'Business', 'Enterprise'];
const STATUSES: (SubscriptionStatus | 'All')[] = [
  'All',
  'Trialing',
  'Active',
  'PastDue',
  'Canceled',
  'Suspended',
];

const STATUS_TONE: Record<SubscriptionStatus, string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Trialing: 'bg-blue-50 text-blue-700 border-blue-200',
  PastDue: 'bg-red-50 text-red-700 border-red-200',
  Suspended: 'bg-red-50 text-red-700 border-red-200',
  Canceled: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** Every customer workspace, with the levers to filter down to the ones that matter. */
export default function TenantList() {
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState<PlanTier | 'All'>('All');
  const [status, setStatus] = useState<SubscriptionStatus | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    // Kicked off in a microtask so the effect body itself does not setState
    // synchronously, which triggers a cascading render.
    void Promise.resolve().then(() => {
      if (!ignore) setLoading(true);
    });

    platformApi
      .tenants({
        ...(tier !== 'All' ? { tier } : {}),
        ...(status !== 'All' ? { status } : {}),
      })
      .then((res) => {
        if (!ignore) {
          setRows(res.data);
          setError('');
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof ApiError ? err.message : 'Could not load workspaces.');
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [tier, status]);

  // Name/slug filtering is local: the list is bounded and this keeps typing
  // responsive without a request per keystroke.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customer workspaces</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? 'Loading…' : `${filtered.length} shown`}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug"
            className="flex-1 text-sm outline-none bg-transparent"
            aria-label="Search workspaces"
          />
        </div>

        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as PlanTier | 'All')}
          aria-label="Filter by plan"
          className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t === 'All' ? 'All plans' : t}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SubscriptionStatus | 'All')}
          aria-label="Filter by status"
          className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All statuses' : s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
                <th className="px-5 py-2.5 font-medium">Workspace</th>
                <th className="px-3 py-2.5 font-medium">Plan</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium text-right">Seats</th>
                <th className="px-3 py-2.5 font-medium text-right">Leads</th>
                <th className="px-3 py-2.5 font-medium text-right">AI / API</th>
                <th className="px-3 py-2.5 font-medium text-right">AI cost</th>
                <th className="px-5 py-2.5 font-medium">Renews</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center">
                    <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-xs text-slate-400">
                    No workspaces match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        to={`/platform/tenants/${row.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="text-[11px] text-slate-400">{row.slug}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{row.subscription?.tier ?? '—'}</td>
                    <td className="px-3 py-3">
                      {row.subscription ? (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            STATUS_TONE[row.subscription.status]
                          }`}
                        >
                          {row.subscription.status}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">no subscription</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">{row.counts.users}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{row.counts.leads}</td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {(row.usage.ai_request ?? 0).toLocaleString('en-IN')}
                      <span className="text-slate-300"> / </span>
                      {(row.usage.api_request ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-900">
                      {formatPaise(row.aiCostPaise)}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {row.subscription
                        ? new Date(row.subscription.currentPeriodEnd).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
