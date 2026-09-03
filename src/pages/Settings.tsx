import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  Settings as SettingsIcon,
  Shield,
  Users,
  Building2,
  Bell,
  Palette,
  Zap
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

import UsersTab from './settings/UsersTab';
import CrmTab from './settings/CrmTab';
import NotificationsTab from './settings/NotificationsTab';
import RolesTab from './settings/RolesTab';
import AppearanceTab from './settings/AppearanceTab';
import IntegrationsTab from './settings/IntegrationsTab';

type TabKey = 'users' | 'crm' | 'notifications' | 'roles' | 'appearance' | 'integrations';

const TABS = [
  { key: 'users',         label: 'Users & Team',     sub: 'Manage access and roles', Icon: Users },
  { key: 'crm',           label: 'CRM Configuration',sub: 'Lead assignment and AI',  Icon: Building2 },
  { key: 'notifications', label: 'Notifications',    sub: 'Alerts and email digest', Icon: Bell },
  { key: 'roles',         label: 'Roles & Permissions',sub: 'Access control matrix', Icon: Shield },
  { key: 'appearance',    label: 'Appearance',       sub: 'Theme and branding',      Icon: Palette },
  { key: 'integrations',  label: 'Integrations',     sub: 'WhatsApp, Gmail, etc.',   Icon: Zap },
] as const;

const TAB_KEYS = TABS.map((t) => t.key);

export default function Settings() {
  const currentUser = useCrmStore((s) => s.currentUser);
  const [searchParams, setSearchParams] = useSearchParams();

  // The social OAuth callback returns to /settings?tab=integrations, so the
  // tab has to be addressable. Without this the user lands back on Users and
  // has to find their way to the connection they just made.
  const requested = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabKey>(
    requested && (TAB_KEYS as readonly string[]).includes(requested)
      ? (requested as TabKey)
      : 'users'
  );

  function selectTab(key: TabKey) {
    setActiveTab(key);
    // Keep the URL in step so the tab survives a refresh and can be linked to.
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="page-stack">

      {/* ═══ SECTION 1 — HEADER ════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-500 text-sm">Manage your CRM workspace and preferences</p>
          </div>
        </div>
        <span className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
          <Shield className="w-4 h-4" />
          {currentUser?.role === 'Admin' ? 'Admin Access' : 'User Access'}
        </span>
      </div>

      {/* ═══ SECTION 2 — MAIN LAYOUT ═══════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[14rem_minmax(0,1fr)] gap-6 items-start">

        {/* LEFT SIDEBAR */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-2">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left mb-0.5 last:mb-0 ${active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
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
        <div className="min-w-0 flex flex-col gap-4">
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'crm' && <CrmTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'roles' && <RolesTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'integrations' && <IntegrationsTab />}
        </div>
      </div>
    </div>
  );
}
