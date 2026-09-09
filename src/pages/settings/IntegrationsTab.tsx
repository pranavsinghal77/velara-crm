import { useEffect, useState } from 'react';
import { Building2, Clock, Copy, Info, Key, Share2, Zap } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import PlatformConnections from '../../components/social/PlatformConnections';

/**
 * Integrations.
 *
 * The previous version of this screen was the least truthful thing in the app:
 * it hardcoded `connected: true` for seven services wired to nothing (complete
 * with a green dot), its Connect and Disconnect buttons only flipped local
 * state that reset on refresh, and it displayed an invented API key
 * (`vk_live_a7b3…`) and webhook URL as if they were the tenant's real
 * credentials.
 *
 * Social channels now come from real OAuth grants, the API-key section reads
 * the actual key manager, and integrations that genuinely have no backend say
 * so instead of claiming to be live.
 */

interface ConnectivityOverview {
  apiKeys: number;
  mcpConnections: number;
  webhooks: number;
  endpoints: { rest: string; mcp: string };
}

/** Integrations with no implementation behind them, stated as such. */
const PLANNED = [
  { name: 'JustDial', desc: 'Auto-import leads from JustDial listings', icon: Zap },
  { name: 'IndiaMART', desc: 'Sync buyer enquiries from IndiaMART', icon: Building2 },
  { name: 'Razorpay', desc: 'Send payment links and track collections', icon: Key },
  { name: 'Tally / TallyPrime', desc: 'Two-way sync of invoices and ledgers', icon: Building2 },
] as const;

export default function IntegrationsTab() {
  const [overview, setOverview] = useState<ConnectivityOverview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let ignore = false;

    api
      .get<ConnectivityOverview>('/connectivity/overview')
      .then((res) => {
        if (!ignore) setOverview(res);
      })
      .catch((err) => {
        if (!ignore) {
          setOverviewError(
            err instanceof ApiError ? err.message : 'Could not load connectivity settings.'
          );
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  function copy(label: string, value: string) {
    void navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  const apiBase = import.meta.env.VITE_API_URL ?? '';
  const mcpUrl = apiBase ? `${apiBase.replace(/\/+$/, '')}/mcp` : '/api/mcp';

  return (
    <>
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-5 text-white">
        <h2 className="font-bold text-base mb-1">Connect your channels</h2>
        <p className="text-blue-100 text-sm">
          Link the accounts Velara publishes to and the systems it exchanges data with.
        </p>
      </div>

      {/* ── Social channels (real OAuth) ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Share2 className="w-4 h-4 text-pink-600" />
          <h2 className="text-base font-semibold text-slate-900">Social channels</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Each connection is a real OAuth grant on the platform. Tokens are stored encrypted and
          used only when you publish.
        </p>

        <PlatformConnections />
      </div>

      {/* ── API access (real keys) ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-4 h-4 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">API &amp; MCP access</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Keys are generated on demand and shown once. Velara stores only a hash, so a key cannot
          be recovered later — issue a new one instead.
        </p>

        {overviewError ? (
          <p className="text-xs text-red-600">{overviewError}</p>
        ) : !overview ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Active API keys', value: overview.apiKeys },
                { label: 'MCP connections', value: overview.mcpConnections },
                { label: 'Outbound webhooks', value: overview.webhooks },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="border border-slate-200 rounded-lg px-4 py-3 bg-slate-50/60"
                >
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-[11px] text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">
                MCP endpoint — point an AI client at this with an API key
              </label>
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[240px] bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                  <code className="text-sm font-mono text-slate-600 break-all">{mcpUrl}</code>
                </div>
                <button
                  onClick={() => copy('mcp', mcpUrl)}
                  className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors shrink-0"
                >
                  <Copy className="w-4 h-4" />
                  {copied === 'mcp' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Authenticate with <code className="bg-slate-100 px-1 rounded">X-API-Key</code> or{' '}
                <code className="bg-slate-100 px-1 rounded">Authorization: Bearer</code>. Six CRM
                tools are exposed; POST{' '}
                <code className="bg-slate-100 px-1 rounded">
                  {'{"jsonrpc":"2.0","id":1,"method":"tools/list"}'}
                </code>{' '}
                to enumerate them.
              </p>
            </div>

            <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              Creating and revoking keys, MCP connections and webhooks is available on the
              connectivity API (<code className="bg-slate-100 px-1 rounded">/api/connectivity</code>
              ). A management screen for it is not built yet.
            </p>
          </div>
        )}
      </div>

      {/* ── Not yet available, stated plainly ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Not yet available</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          These have no implementation behind them yet. They are listed so you know what is planned,
          not offered as working connections.
        </p>

        <ul className="divide-y divide-slate-50">
          {PLANNED.map((item) => (
            <li key={item.name} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{item.name}</p>
                  <p className="text-xs text-slate-400 truncate">{item.desc}</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                planned
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
