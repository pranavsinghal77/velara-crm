import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Users,
  Building2,
  Bell,
  Palette,
  Zap,
  UserPlus,
  Pencil,
  MoreVertical,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Mail,
  MessageSquare,
  Phone,
  Flame,
  Clock,
  Trophy,
  TrendingDown,
  Calendar,
  Paintbrush,
  Key,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { getUsers, saveUsers, getCurrentUser } from '../types/index';
import type { User } from '../types/index';

// ─── types ────────────────────────────────────────────────────────────────────

type TabKey = 'users' | 'crm' | 'notifications' | 'roles' | 'appearance' | 'integrations';

interface CrmSettings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  industry: string;
  city: string;
  website: string;
  hotThreshold: number;
  followUpDays: string;
  autoAssign: boolean;
  roundRobin: boolean;
  jdWeight: number;
  imWeight: number;
  webWeight: number;
  waWeight: number;
  aiScoring: boolean;
  aiFollowUp: boolean;
  aiTranscription: boolean;
  aiPostGen: boolean;
  aiLang: string;
}

interface NotifSettings {
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
  browser: boolean;
  callNotif: boolean;
  aiInsights: boolean;
  hotLead: boolean;
  followUpReminder: boolean;
  reminderBefore: string;
  dealWon: boolean;
  churnRisk: boolean;
  dailySummary: boolean;
}

interface AppearSettings {
  theme: string;
  primaryColor: string;
  compact: boolean;
  fontSize: string;
  showAiBadges: boolean;
  animations: boolean;
  showWelcome: boolean;
}

// ─── constants ────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; sub: string; Icon: typeof Users }[] = [
  { key: 'users',        label: 'User Management',    sub: 'Team & access control',   Icon: Users     },
  { key: 'crm',          label: 'CRM Configuration',  sub: 'Lead & pipeline settings', Icon: Building2 },
  { key: 'notifications',label: 'Notifications',       sub: 'Alert preferences',        Icon: Bell      },
  { key: 'roles',        label: 'Roles & Permissions', sub: 'Access matrix',            Icon: Shield    },
  { key: 'appearance',   label: 'Appearance',          sub: 'Theme & display',          Icon: Palette   },
  { key: 'integrations', label: 'Integrations',        sub: 'API & connections',        Icon: Zap       },
];

const ROLE_BADGE: Record<string, string> = {
  Admin:   'bg-red-100 text-red-700 border border-red-200',
  Manager: 'bg-amber-100 text-amber-700 border border-amber-200',
  Sales:   'bg-green-100 text-green-700 border border-green-200',
  Viewer:  'bg-gray-100 text-gray-600 border border-gray-200',
};

const PERM_LABELS = [
  'View Leads', 'Add & Edit Leads', 'Delete Leads', 'View Inbox',
  'Send Messages', 'View Analytics', 'Manage Reminders',
  'Export Data', 'Manage Users', 'System Settings',
];

const DEFAULT_PERMS: Record<string, boolean[]> = {
  Manager: [true, true, true, true, true, true, true, true, true, false],
  Sales:   [true, true, false, true, true, true, true, false, false, false],
  Viewer:  [true, false, false, true, false, false, false, false, false, false],
};

const CRM_DEF: CrmSettings = {
  companyName: 'Velara CRM', companyEmail: '', companyPhone: '', industry: 'IT Services',
  city: '', website: '', hotThreshold: 75, followUpDays: '2 days', autoAssign: true,
  roundRobin: false, jdWeight: 85, imWeight: 80, webWeight: 70, waWeight: 65,
  aiScoring: true, aiFollowUp: true, aiTranscription: true, aiPostGen: true, aiLang: 'English',
};

const NOTIF_DEF: NotifSettings = {
  whatsapp: true, email: true, sms: false, browser: true, callNotif: true, aiInsights: true,
  hotLead: true, followUpReminder: true, reminderBefore: '1 hour', dealWon: true,
  churnRisk: true, dailySummary: true,
};

const APPEAR_DEF: AppearSettings = {
  theme: 'Light', primaryColor: '#2563EB', compact: false, fontSize: 'Medium',
  showAiBadges: true, animations: true, showWelcome: true,
};

const EMPTY_FORM = { name: '', email: '', role: 'Sales' as User['role'], password: '', permissions: [true, true, false, true, true, true, false, false] };

const INTEGRATIONS = [
  { name: 'WhatsApp Business API', desc: 'Send messages and receive leads from WhatsApp',    icon: MessageSquare, bg: 'bg-green-500',   connected: true  },
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

// ─── helpers ─────────────────────────────────────────────────────────────────

function loadJson<T>(key: string, def: T): T {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : def; }
  catch { return def; }
}
function saveJson(key: string, v: unknown) { localStorage.setItem(key, JSON.stringify(v)); }

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-1'}`} />
    </button>
  );
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Settings() {
  const currentUser = getCurrentUser();
  const [activeTab, setActiveTab] = useState<TabKey>('users');

  // users
  const [users, setUsers] = useState<User[]>(() => getUsers());
  const [inviteModal, setInviteModal] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_FORM);

  function persistUsers(next: User[]) { saveUsers(next); setUsers(next); }
  function toggleActive(id: string) { persistUsers(users.map((u) => u.id === id ? { ...u, isActive: !u.isActive } : u)); }

  function handleSaveInvite() {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password) return;
    const nu: User = {
      id: 'u' + Date.now(), name: userForm.name, email: userForm.email,
      password: userForm.password, role: userForm.role, isActive: true, permissions: [],
    };
    persistUsers([...users, nu]);
    setInviteModal(false);
    setUserForm(EMPTY_FORM);
  }

  // crm
  const [crm, setCrm] = useState<CrmSettings>(() => loadJson('velara_settings', CRM_DEF));
  function saveCrm(v: CrmSettings) { setCrm(v); saveJson('velara_settings', v); }

  // notifications
  const [notif, setNotif] = useState<NotifSettings>(() => loadJson('velara_notifications', NOTIF_DEF));
  function saveNotif(v: NotifSettings) { setNotif(v); saveJson('velara_notifications', v); }

  // permissions
  const [perms, setPerms] = useState<Record<string, boolean[]>>(() => loadJson('velara_permissions', DEFAULT_PERMS));
  function togglePerm(role: string, idx: number) {
    const next = { ...perms, [role]: perms[role].map((v, i) => i === idx ? !v : v) };
    setPerms(next); saveJson('velara_permissions', next);
  }

  // appearance
  const [appear, setAppear] = useState<AppearSettings>(() => loadJson('velara_settings_appear', APPEAR_DEF));
  function saveAppear(v: AppearSettings) { setAppear(v); saveJson('velara_settings_appear', v); }

  // integrations
  const [integrations, setIntegrations] = useState(INTEGRATIONS.map((ig) => ({ ...ig })));
  function toggleIntegration(name: string) {
    setIntegrations((prev) => prev.map((ig) => ig.name === name ? { ...ig, connected: !ig.connected } : ig));
  }

  // api key
  const [showApiKey, setShowApiKey] = useState(false);
  const API_KEY = 'vk_live_a7b3c9d1e4f2g8h6i5j0k';
  const WEBHOOK_URL = 'https://api.velara.in/webhooks/v1/inbound/abc123';

  return (
    <div className="space-y-6">

      {/* ═══ SECTION 1 — HEADER ════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-500 text-sm">Manage your CRM workspace and preferences</p>
          </div>
        </div>
        <span className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
          <Shield className="w-4 h-4" />
          Admin Access
        </span>
      </div>

      {/* ═══ SECTION 2 — MAIN LAYOUT ═══════════════════════ */}
      <div className="flex gap-6 items-start">

        {/* LEFT SIDEBAR */}
        <div className="w-56 flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-2">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left mb-0.5 last:mb-0 ${active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <t.Icon className="w-4 h-4 flex-shrink-0" />
                <div className="flex flex-col gap-0 min-w-0">
                  <span className="text-sm font-medium leading-tight">{t.label}</span>
                  {!active && <span className="text-xs opacity-60 truncate">{t.sub}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* RIGHT CONTENT */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* ══════ TAB 1: USER MANAGEMENT ══════ */}
          {activeTab === 'users' && (
            <>
              {/* Header card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">Team Members</span>
                  <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{users.length} members</span>
                </div>
                <button
                  onClick={() => { setUserForm(EMPTY_FORM); setInviteModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Member
                </button>
              </div>

              {/* Users table card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <div className="col-span-5">Member</div>
                  <div className="col-span-2">Role</div>
                  <div className="col-span-3">Permissions</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Actions</div>
                </div>

                {users.map((u) => {
                  const initials = u.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
                  const SAMPLE_PERMS = ['View', 'Add', 'Inbox', 'Messages', 'Analytics'];
                  return (
                    <div key={u.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 items-center">
                      {/* Member */}
                      <div className="col-span-5 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 text-sm truncate">{u.name}</span>
                            {currentUser?.id === u.id && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">You</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 truncate">{u.email}</span>
                        </div>
                      </div>

                      {/* Role */}
                      <div className="col-span-2">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                      </div>

                      {/* Permissions */}
                      <div className="col-span-3">
                        <div className="flex flex-wrap gap-1">
                          {SAMPLE_PERMS.slice(0, 3).map((p) => (
                            <span key={p} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{p}</span>
                          ))}
                          {SAMPLE_PERMS.length > 3 && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">+{SAMPLE_PERMS.length - 3} more</span>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="col-span-1">
                        <Toggle on={u.isActive} onToggle={() => toggleActive(u.id)} />
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex gap-1">
                        <button className="p-1.5 bg-gray-100 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition-colors">
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </button>
                        <button className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ══════ TAB 2: CRM CONFIGURATION ══════ */}
          {activeTab === 'crm' && (
            <>
              {/* Company Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-semibold text-gray-900">Company Information</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Company Name</label>
                    <input value={crm.companyName} onChange={(e) => setCrm({ ...crm, companyName: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Business Email</label>
                    <input type="email" value={crm.companyEmail} onChange={(e) => setCrm({ ...crm, companyEmail: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Phone Number</label>
                    <input value={crm.companyPhone} onChange={(e) => setCrm({ ...crm, companyPhone: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Industry</label>
                    <select value={crm.industry} onChange={(e) => setCrm({ ...crm, industry: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {['Real Estate','Manufacturing','IT Services','Retail','Healthcare','Education','Finance','Other'].map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">City</label>
                    <input value={crm.city} onChange={(e) => setCrm({ ...crm, city: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Website URL</label>
                    <input value={crm.website} onChange={(e) => setCrm({ ...crm, website: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={() => saveCrm(crm)} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Save Changes</button>
                </div>
              </div>

              {/* Lead Management */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-semibold text-gray-900">Lead Management Settings</h2>
                </div>
                <div className="flex flex-col gap-5">
                  {/* HOT Threshold */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">HOT Lead Score Threshold</p>
                      <p className="text-xs text-gray-500 mt-0.5">Leads scoring above this are marked HOT 🔥</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="range" min={50} max={95} step={5} value={crm.hotThreshold}
                        onChange={(e) => setCrm({ ...crm, hotThreshold: Number(e.target.value) })}
                        className="w-32 accent-blue-600" />
                      <span className="text-lg font-bold text-blue-600 w-12 text-right">{crm.hotThreshold}<span className="text-sm">/100</span></span>
                    </div>
                  </div>

                  {/* Follow-up timing */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Auto Follow-up Timing</p>
                      <p className="text-xs text-gray-500 mt-0.5">Default reminder timing for follow-ups</p>
                    </div>
                    <select value={crm.followUpDays} onChange={(e) => setCrm({ ...crm, followUpDays: e.target.value })}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {['1 day','2 days','3 days','1 week'].map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </div>

                  {/* Assignment toggles */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Auto-assign new leads</p>
                      <p className="text-xs text-gray-500 mt-0.5">Automatically assign leads to available reps</p>
                    </div>
                    <Toggle on={crm.autoAssign} onToggle={() => setCrm({ ...crm, autoAssign: !crm.autoAssign })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Round-robin assignment</p>
                      <p className="text-xs text-gray-500 mt-0.5">Distribute leads equally across all reps</p>
                    </div>
                    <Toggle on={crm.roundRobin} onToggle={() => setCrm({ ...crm, roundRobin: !crm.roundRobin })} />
                  </div>

                  {/* Lead scoring weights */}
                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-3">Lead Scoring Weights by Source</p>
                    {([
                      { label: 'JustDial', key: 'jdWeight' as const, color: 'bg-blue-100 text-blue-700' },
                      { label: 'IndiaMART', key: 'imWeight' as const, color: 'bg-orange-100 text-orange-700' },
                      { label: 'Website',  key: 'webWeight' as const, color: 'bg-green-100 text-green-700' },
                      { label: 'WhatsApp', key: 'waWeight' as const,  color: 'bg-teal-100 text-teal-700' },
                    ]).map((s) => (
                      <div key={s.key} className="flex items-center gap-3 mb-3 last:mb-0">
                        <span className={`text-xs font-semibold px-2 py-1 rounded w-24 text-center flex-shrink-0 ${s.color}`}>{s.label}</span>
                        <input type="range" min={0} max={100} value={crm[s.key]}
                          onChange={(e) => setCrm({ ...crm, [s.key]: Number(e.target.value) })}
                          className="flex-1 accent-blue-600" />
                        <span className="text-sm font-medium text-gray-700 w-12 text-right">{crm[s.key]}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Configuration */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h2 className="text-base font-semibold text-gray-900">Velara AI Settings</h2>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mb-4 flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-purple-700">These settings control Velara AI behavior across all modules including lead scoring, follow-up suggestions and call transcription.</p>
                </div>
                <div className="flex flex-col gap-4">
                  {([
                    { key: 'aiScoring' as const, label: 'AI Lead Scoring', desc: 'Automatically score leads 0-100 based on source, recency and profile completeness' },
                    { key: 'aiFollowUp' as const, label: 'AI Follow-up Suggestions', desc: 'AI suggests optimal follow-up timing and message' },
                    { key: 'aiTranscription' as const, label: 'AI Call Transcription', desc: 'Auto-transcribe all recorded calls' },
                    { key: 'aiPostGen' as const, label: 'AI Post Generation', desc: 'Generate social media content with AI' },
                  ]).map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                      </div>
                      <Toggle on={crm[item.key]} onToggle={() => saveCrm({ ...crm, [item.key]: !crm[item.key] })} />
                    </div>
                  ))}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">AI Response Language</p>
                    <div className="flex gap-2">
                      {['English','Hindi','Hinglish'].map((v) => (
                        <button key={v} onClick={() => saveCrm({ ...crm, aiLang: v })}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${crm.aiLang === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══════ TAB 3: NOTIFICATIONS ══════ */}
          {activeTab === 'notifications' && (
            <>
              {/* Header */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">Notification Preferences</span>
                </div>
                <button onClick={() => saveNotif(notif)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Save All</button>
              </div>

              {/* Channel notifications */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Notification Channels</h3>
                </div>
                {([
                  { key: 'whatsapp' as const,   Icon: MessageSquare, iconBg: 'bg-green-100 text-green-600',  title: 'WhatsApp Alerts',         desc: 'Lead + follow-up alerts via WhatsApp'   },
                  { key: 'email' as const,       Icon: Mail,          iconBg: 'bg-blue-100 text-blue-600',    title: 'Email Notifications',     desc: 'Daily summary + alerts via email'       },
                  { key: 'sms' as const,         Icon: MessageSquare, iconBg: 'bg-gray-100 text-gray-600',    title: 'SMS Reminders',           desc: 'Follow-up reminders via SMS'            },
                  { key: 'browser' as const,     Icon: Bell,          iconBg: 'bg-indigo-100 text-indigo-600',title: 'Browser Push',            desc: 'Real-time alerts in browser'            },
                  { key: 'callNotif' as const,   Icon: Phone,         iconBg: 'bg-green-100 text-green-600',  title: 'Call Notifications',      desc: 'Missed call + voicemail alerts'         },
                  { key: 'aiInsights' as const,  Icon: Sparkles,      iconBg: 'bg-purple-100 text-purple-600',title: 'AI Insights',             desc: 'Daily AI performance briefing'          },
                ]).map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.iconBg}`}>
                        <item.Icon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-800">{item.title}</span>
                        <span className="text-xs text-gray-500">{item.desc}</span>
                      </div>
                    </div>
                    <Toggle on={notif[item.key]} onToggle={() => saveNotif({ ...notif, [item.key]: !notif[item.key] })} />
                  </div>
                ))}
              </div>

              {/* Alert types */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Alert Triggers</h3>
                </div>

                <div className="flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">HOT Lead Alert</p>
                      <p className="text-xs text-gray-500">Instant alert when lead becomes HOT</p>
                    </div>
                  </div>
                  <Toggle on={notif.hotLead} onToggle={() => saveNotif({ ...notif, hotLead: !notif.hotLead })} />
                </div>

                <div className="flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Follow-up Reminders</p>
                      <p className="text-xs text-gray-500">Reminder before follow-up due</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select value={notif.reminderBefore} onChange={(e) => saveNotif({ ...notif, reminderBefore: e.target.value })}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                      {['30 min','1 hour','2 hours'].map((v) => <option key={v}>{v}</option>)}
                    </select>
                    <Toggle on={notif.followUpReminder} onToggle={() => saveNotif({ ...notif, followUpReminder: !notif.followUpReminder })} />
                  </div>
                </div>

                {([
                  { key: 'dealWon' as const,      Icon: Trophy,        bg: 'bg-green-100',  ic: 'text-green-600', title: 'Deal Won Alert',    desc: 'Celebrate every closed deal'             },
                  { key: 'churnRisk' as const,     Icon: TrendingDown,  bg: 'bg-red-100',    ic: 'text-red-500',   title: 'Churn Risk Alert',  desc: 'Alert when lead shows disengagement'     },
                  { key: 'dailySummary' as const,  Icon: Calendar,      bg: 'bg-blue-100',   ic: 'text-blue-600',  title: 'Daily Summary',     desc: 'Morning briefing every day at 9 AM'      },
                ]).map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}>
                        <item.Icon className={`w-5 h-5 ${item.ic}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                    <Toggle on={notif[item.key]} onToggle={() => saveNotif({ ...notif, [item.key]: !notif[item.key] })} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══════ TAB 4: ROLES & PERMISSIONS ══════ */}
          {activeTab === 'roles' && (
            <>
              {/* Warning banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">Admin has full access to all features and cannot be restricted. Manage permissions for Manager, Sales, and Viewer roles below.</p>
              </div>

              {/* Permissions matrix */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Header row */}
                <div className="grid grid-cols-6 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <div className="col-span-2">Permission</div>
                  {(['Admin','Manager','Sales','Viewer'] as const).map((r) => (
                    <div key={r} className="text-center">
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[r]}`}>{r}</span>
                    </div>
                  ))}
                </div>

                {PERM_LABELS.map((label, idx) => (
                  <div key={label} className="grid grid-cols-6 px-6 py-3 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50 transition-colors">
                    <div className="col-span-2 text-sm text-gray-700">{label}</div>
                    {/* Admin — always on */}
                    <div className="flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                    {/* Manager, Sales, Viewer */}
                    {(['Manager','Sales','Viewer'] as const).map((role) => {
                      const checked = perms[role]?.[idx] ?? false;
                      return (
                        <div key={role} className="flex items-center justify-center">
                          <button
                            onClick={() => togglePerm(role, idx)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 hover:border-blue-400'}`}
                          >
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button onClick={() => saveJson('velara_permissions', perms)} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Save Permissions</button>
              </div>
            </>
          )}

          {/* ══════ TAB 5: APPEARANCE ══════ */}
          {activeTab === 'appearance' && (
            <>
              {/* Theme */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-semibold text-gray-900">Theme</h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {([
                    { id: 'Light', label: 'Light', soon: false },
                    { id: 'Dark',  label: 'Dark',  soon: true  },
                    { id: 'Auto',  label: 'Auto (System)', soon: true },
                  ] as const).map((t) => {
                    const sel = appear.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { if (!t.soon) saveAppear({ ...appear, theme: t.id }); }}
                        className={`relative rounded-xl border-2 p-4 text-left transition-colors ${sel ? 'border-blue-600' : 'border-gray-200 hover:border-gray-300'} ${t.soon ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className={`w-full h-20 rounded-lg mb-3 overflow-hidden border ${t.id === 'Light' ? 'bg-white' : t.id === 'Dark' ? 'bg-gray-900' : 'bg-gradient-to-r from-white to-gray-900'}`}>
                          <div className="flex h-full">
                            <div className={`w-6 h-full ${t.id === 'Dark' ? 'bg-gray-800' : 'bg-slate-800'}`} />
                            <div className="flex-1 p-1.5 flex flex-col gap-1">
                              <div className={`h-2 rounded ${t.id === 'Dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
                              <div className={`h-2 w-3/4 rounded ${t.id === 'Dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
                              <div className={`flex-1 rounded mt-1 ${t.id === 'Dark' ? 'bg-gray-800' : 'bg-gray-100'}`} />
                            </div>
                          </div>
                        </div>
                        <p className={`text-xs font-semibold text-center ${sel ? 'text-blue-700' : 'text-gray-700'}`}>{t.label}</p>
                        {sel && <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                        {t.soon && <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Coming Soon</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Brand Color */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Paintbrush className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-semibold text-gray-900">Brand Color</h2>
                </div>
                <div className="flex gap-4">
                  {([
                    { c: '#2563EB', label: 'Blue'   },
                    { c: '#7C3AED', label: 'Purple' },
                    { c: '#059669', label: 'Green'  },
                    { c: '#EA580C', label: 'Orange' },
                    { c: '#E11D48', label: 'Rose'   },
                  ]).map((s) => {
                    const sel = appear.primaryColor === s.c;
                    return (
                      <button key={s.c} onClick={() => saveAppear({ ...appear, primaryColor: s.c })} className="flex flex-col items-center gap-1 group">
                        <div className={`w-10 h-10 rounded-full transition-transform group-hover:scale-110 border-4 ${sel ? 'border-gray-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: s.c }} />
                        <span className="text-[10px] text-gray-500">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Display Settings */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Display Preferences</h2>
                <div className="flex flex-col gap-4">
                  {([
                    { key: 'compact' as const,     label: 'Compact Mode',          desc: 'Reduce padding for more content visibility'   },
                    { key: 'showAiBadges' as const, label: 'Show AI Badges',        desc: 'Show AI score badges on lead cards'            },
                    { key: 'animations' as const,   label: 'Animations',            desc: 'Enable smooth page transitions'               },
                    { key: 'showWelcome' as const,  label: 'Show Welcome Message',  desc: 'Show AI daily briefing on dashboard'          },
                  ]).map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                      </div>
                      <Toggle on={appear[item.key]} onToggle={() => saveAppear({ ...appear, [item.key]: !appear[item.key] })} />
                    </div>
                  ))}

                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-2">Font Size</p>
                    <div className="flex gap-2">
                      {['Small','Medium','Large'].map((v) => (
                        <button key={v} onClick={() => saveAppear({ ...appear, fontSize: v })}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${appear.fontSize === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══════ TAB 6: INTEGRATIONS ══════ */}
          {activeTab === 'integrations' && (
            <>
              {/* Banner */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-5 text-white">
                <h2 className="font-bold text-base mb-1">Connect Your Tools</h2>
                <p className="text-blue-200 text-sm">Integrate Velara CRM with your existing business tools and platforms</p>
              </div>

              {/* Integration cards */}
              <div className="grid grid-cols-1 gap-4">
                {integrations.map((ig) => (
                  <div key={ig.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl ${ig.bg} flex items-center justify-center text-white shrink-0`}>
                        <ig.icon className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-gray-900 text-sm">{ig.name}</span>
                        <span className="text-xs text-gray-500">{ig.desc}</span>
                        {ig.connected ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            Connected
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Not connected</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {ig.connected ? (
                        <>
                          <button className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700">Configure</button>
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Key className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-semibold text-gray-900">API Keys & Webhooks</h2>
                </div>
                <div className="flex flex-col gap-4">
                  {/* API Key */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-2">Your Velara API Key</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={API_KEY}
                          readOnly
                          className="flex-1 bg-transparent text-sm font-mono outline-none text-gray-600"
                        />
                        <button onClick={() => setShowApiKey((v) => !v)} className="text-gray-400 hover:text-gray-600">
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button onClick={() => void navigator.clipboard.writeText(API_KEY)} className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                        <Copy className="w-4 h-4" /> Copy
                      </button>
                      <button className="flex items-center gap-2 px-3 py-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Webhook URL */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-2">Webhook Endpoint</label>
                    <div className="flex gap-3">
                      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                        <input
                          type="text"
                          value={WEBHOOK_URL}
                          readOnly
                          className="w-full bg-transparent text-sm font-mono outline-none text-gray-600"
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
          )}

        </div>
      </div>

      {/* ═══ INVITE MODAL ══════════════════════════════════ */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setInviteModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">Invite Team Member</h3>
              <button onClick={() => setInviteModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Full Name *</label>
                <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Email *</label>
                <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Role *</label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as User['role'] })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {['Admin','Manager','Sales','Viewer'].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Password *</label>
                <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Permissions */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">Initial Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {['View Leads','Add/Edit Leads','Delete Leads','View Inbox','Send Messages','View Analytics','Manage Settings','Export Data'].map((p, i) => (
                    <label key={p} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={userForm.permissions[i] ?? false}
                        onChange={(e) => setUserForm({ ...userForm, permissions: userForm.permissions.map((v, j) => j === i ? e.target.checked : v) })}
                        className="accent-blue-600" />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setInviteModal(false)} className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSaveInvite} className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Send Invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
