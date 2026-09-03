import { useState } from 'react';

import { Shield, Users, Building2, Zap, Copy, Mail, Phone, TrendingDown, Key, EyeOff, Eye, RefreshCw } from 'lucide-react';

const INTEGRATIONS = [
  { name: 'WhatsApp Business API', desc: 'Send messages and receive leads from WhatsApp',    icon: Mail,           bg: 'bg-green-500',   connected: true  },
  { name: 'JustDial',              desc: 'Auto-import leads from JustDial listings',          icon: Zap,           bg: 'bg-orange-500',  connected: true  },
  { name: 'IndiaMART',             desc: 'Sync buyer enquiries from IndiaMART',               icon: Building2,     bg: 'bg-blue-600',    connected: true  },
  { name: 'Gmail / Google Workspace', desc: 'Sync emails and calendar with CRM',              icon: Mail,          bg: 'bg-red-500',     connected: true  },
  { name: 'Razorpay',              desc: 'Send payment links and track collections',           icon: Key,           bg: 'bg-blue-700',    connected: false },
  { name: 'Supabase Database',     desc: 'Connected database for data storage',               icon: Shield,        bg: 'bg-emerald-600', connected: true  },
  { name: 'AWS S3 / Cloud Storage',desc: 'Document and recording storage',                    icon: Copy,          bg: 'bg-amber-500',   connected: false },
  { name: 'Twilio (VoIP)',         desc: 'Power VoIP calling and SMS',                        icon: Phone,         bg: 'bg-red-600',     connected: true  },
  { name: 'Meta Business',         desc: 'Social media posting and lead ads',                 icon: Users,         bg: 'bg-blue-500',    connected: true  },
  { name: 'LinkedIn',              desc: 'Professional network integration',                  icon: Users,         bg: 'bg-blue-700',    connected: false },
  { name: 'Zapier',                desc: 'Connect 5000+ apps via automation',                 icon: Zap,           bg: 'bg-orange-500',  connected: false },
  { name: 'Google Analytics',      desc: 'Track CRM usage and conversions',                   icon: TrendingDown,  bg: 'bg-amber-500',   connected: false },
];

export default function IntegrationsTab() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS.map((ig) => ({ ...ig })));
  function toggleIntegration(name: string) {
    setIntegrations((prev) => prev.map((ig) => ig.name === name ? { ...ig, connected: !ig.connected } : ig));
  }

  // api key
  const [showApiKey, setShowApiKey] = useState(false);
  const API_KEY = 'vk_live_a7b3c9d1e4f2g8h6i5j0k';
  const WEBHOOK_URL = 'https://api.velara.in/webhooks/v1/inbound/abc123';

  return (
    <>
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-5 text-white">
        <h2 className="font-bold text-base mb-1">Connect Your Tools</h2>
        <p className="text-blue-200 text-sm">Integrate Velara CRM with your existing business tools and platforms</p>
      </div>

      {/* Integration cards */}
      <div className="grid grid-cols-1 gap-4">
        {integrations.map((ig) => (
          <div key={ig.name} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${ig.bg} flex items-center justify-center text-white shrink-0`}>
                <ig.icon className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-slate-900 text-sm">{ig.name}</span>
                <span className="text-xs text-slate-500">{ig.desc}</span>
                {ig.connected ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Connected
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Not connected</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {ig.connected ? (
                <>
                  <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-700">Configure</button>
                  <button onClick={() => toggleIntegration(ig.name)} className="px-3 py-1.5 text-xs font-medium border border-red-200 rounded-lg hover:bg-red-50 text-red-600 transition-colors">Disconnect</button>
                </>
              ) : (
                <button onClick={() => toggleIntegration(ig.name)} className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Connect</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">API Keys & Webhooks</h2>
        </div>
        <div className="flex flex-col gap-4">
          {/* API Key */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-2">Your Velara API Key</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={API_KEY}
                  readOnly
                  className="flex-1 bg-transparent text-sm font-mono outline-none text-slate-600"
                />
                <button onClick={() => setShowApiKey((v) => !v)} className="text-slate-400 hover:text-slate-600">
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button onClick={() => void navigator.clipboard.writeText(API_KEY)} className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button className="flex items-center gap-2 px-3 py-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Webhook URL */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-2">Webhook Endpoint</label>
            <div className="flex gap-3">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <input
                  type="text"
                  value={WEBHOOK_URL}
                  readOnly
                  className="w-full bg-transparent text-sm font-mono outline-none text-slate-600"
                />
              </div>
              <button onClick={() => void navigator.clipboard.writeText(WEBHOOK_URL)} className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                <Copy className="w-4 h-4" /> Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
