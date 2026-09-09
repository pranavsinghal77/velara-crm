import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  PLATFORM_BRAND,
  STATUS_TONE,
  readOAuthOutcome,
  socialApi,
  type SocialProvider,
} from '../../lib/social';
import { useCrmStore } from '../../store/useCrmStore';

/**
 * Real platform connections.
 *
 * Each card's state comes from the server: whether this deployment holds the
 * provider's client credentials at all, and which accounts the tenant has an
 * actual OAuth grant for. Nothing here can display "Connected" without a
 * stored token behind it.
 */
export default function PlatformConnections() {
  const role = useCrmStore((s) => s.currentUser?.role);
  const isAdmin = role === 'Admin';

  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [encryptionAvailable, setEncryptionAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await socialApi.providers();
      setProviders(res.data);
      setEncryptionAvailable(res.encryptionAvailable);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load social channels.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Report the result of the OAuth round trip we just came back from.
    const outcome = readOAuthOutcome();
    if (outcome?.error) setError(outcome.error);
    if (outcome?.ok) {
      setNotice(
        outcome.accounts && outcome.accounts > 1
          ? `Connected ${outcome.ok} — ${outcome.accounts} accounts available.`
          : `Connected ${outcome.ok}.`
      );
    }
    void load();
  }, [load]);

  async function act(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      setNotice(await fn());
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

  async function connect(provider: SocialProvider) {
    setBusy(`connect:${provider.platform}`);
    setError('');
    try {
      const { authorizeUrl } = await socialApi.startConnect(provider.platform);
      // Full navigation, not a popup: providers block being framed, and this
      // keeps the flow working when popups are denied.
      window.location.assign(authorizeUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the connection.');
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl"
        >
          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span className="text-xs text-emerald-800 flex-1">{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs font-semibold text-emerald-700">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl"
        >
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="text-xs text-red-800 flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-xs font-semibold text-red-700">
            Dismiss
          </button>
        </div>
      )}

      {!encryptionAvailable && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            This server has no <code className="bg-white px-1 rounded">ENCRYPTION_KEY</code>, so
            platform tokens cannot be stored securely. Connecting is disabled until one is set.
          </p>
        </div>
      )}

      {providers.map((provider) => {
        const brand = PLATFORM_BRAND[provider.platform];
        const connectKey = `connect:${provider.platform}`;

        return (
          <div
            key={provider.platform}
            className="bg-white rounded-xl shadow-sm border border-slate-100 p-5"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className={`w-12 h-12 rounded-xl ${brand.iconBg} flex items-center justify-center text-white font-bold shrink-0`}
                >
                  {brand.short}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{provider.label}</span>
                    {provider.capabilities.messaging && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        messaging channel
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{provider.description}</p>

                  {/* Availability is the honest headline: a platform this
                      server has no credentials for cannot be connected, and
                      says exactly what is missing. */}
                  {!provider.configured ? (
                    <p className="text-xs text-slate-500 mt-2 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        Not available on this server. An administrator needs to set{' '}
                        {provider.missingEnv.map((name, i) => (
                          <span key={name}>
                            {i > 0 && ', '}
                            <code className="bg-slate-100 px-1 rounded">{name}</code>
                          </span>
                        ))}
                        .
                      </span>
                    </p>
                  ) : provider.connections.length === 0 ? (
                    <p className="text-xs text-slate-400 mt-2">No account connected.</p>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0">
                {provider.configured && encryptionAvailable && isAdmin && (
                  <button
                    onClick={() => void connect(provider)}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {busy === connectKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Link2 className="w-3.5 h-3.5" />
                    )}
                    {provider.connections.length > 0 ? 'Add account' : 'Connect'}
                  </button>
                )}
                {!isAdmin && provider.configured && (
                  <span className="text-[11px] text-slate-400">Admin access required</span>
                )}
              </div>
            </div>

            {/* Setup caveats the credentials alone do not resolve. */}
            {provider.configured && provider.setupNote && (
              <p className="mt-3 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                {provider.setupNote}
              </p>
            )}

            {/* Connected accounts */}
            {provider.connections.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-50 border-t border-slate-100">
                {provider.connections.map((conn) => (
                  <li key={conn.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      {conn.avatarUrl ? (
                        <img
                          src={conn.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {conn.handle}
                          </span>
                          {conn.isDefault && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              default
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_TONE[conn.status]}`}
                          >
                            {conn.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {conn.statusDetail
                            ? conn.statusDetail
                            : conn.expiresAt
                              ? `Token expires ${new Date(conn.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                              : 'Long-lived token'}
                          {conn.lastPublishAt &&
                            ` · last posted ${new Date(conn.lastPublishAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                        </p>
                        {conn.expiringSoon && conn.status === 'Connected' && (
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            Expires soon — verify to refresh it.
                          </p>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!conn.isDefault && (
                          <button
                            title="Make default target"
                            disabled={busy !== null}
                            onClick={() =>
                              void act(`default:${conn.id}`, async () => {
                                await socialApi.setDefault(conn.id);
                                return `${conn.handle} is now the default ${provider.label} target.`;
                              })
                            }
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          title="Verify and refresh the token"
                          disabled={busy !== null}
                          onClick={() =>
                            void act(`verify:${conn.id}`, async () => {
                              const updated = await socialApi.verify(conn.id);
                              return updated.status === 'Connected'
                                ? `${conn.handle} verified.`
                                : `${conn.handle}: ${updated.statusDetail ?? updated.status}`;
                            })
                          }
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {busy === `verify:${conn.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          title="Disconnect"
                          disabled={busy !== null}
                          onClick={() =>
                            void act(`remove:${conn.id}`, async () => {
                              await socialApi.disconnect(conn.id);
                              return `Disconnected ${conn.handle}. Posts already published stay live on ${provider.label}.`;
                            })
                          }
                          className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* The redirect URI an operator has to register, shown where they
                need it rather than buried in a README. */}
            {isAdmin && !provider.configured && (
              <details className="mt-3">
                <summary className="text-[11px] font-semibold text-slate-500 cursor-pointer">
                  Setup details
                </summary>
                <div className="mt-2 text-[11px] text-slate-500 space-y-1">
                  <p>
                    Register this redirect URI on the provider app:
                    <code className="block mt-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono break-all">
                      {provider.redirectUri}
                    </code>
                  </p>
                  <p>
                    Scopes requested:{' '}
                    <span className="font-mono">{provider.scopes.join(', ')}</span>
                  </p>
                </div>
              </details>
            )}
          </div>
        );
      })}

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <ExternalLink className="w-3 h-3" />
        Connecting opens the platform&apos;s own consent screen. Velara stores only the token it
        returns, encrypted, and never your platform password.
      </p>
    </div>
  );
}
