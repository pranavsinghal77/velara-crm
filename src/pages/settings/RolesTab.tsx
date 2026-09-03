import { useState } from 'react';

import { AlertCircle, CheckCircle2, Check } from 'lucide-react';
import { loadJson, saveJson } from './storage';

const ROLE_BADGE: Record<string, string> = {
  Admin: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Sales: 'bg-green-100 text-green-700',
  Viewer: 'bg-slate-100 text-slate-700',
};

const PERM_LABELS = [
  'View Leads (All)', 'Add / Edit Leads', 'Delete Leads', 'View Inbox',
  'Send Messages', 'View Analytics', 'Manage Settings', 'Export Data',
];

const DEFAULT_PERMS: Record<string, boolean[]> = {
  Manager: [true, true, true, true, true, true, false, true],
  Sales:   [true, true, false, true, true, false, false, false],
  Viewer:  [true, false, false, false, false, false, false, false],
};

export default function RolesTab() {
  const [perms, setPerms] = useState<Record<string, boolean[]>>(() => loadJson('velara_permissions', DEFAULT_PERMS));
  function togglePerm(role: string, idx: number) {
    const next = { ...perms, [role]: perms[role].map((v, i) => i === idx ? !v : v) };
    setPerms(next); saveJson('velara_permissions', next);
  }

  return (
    <>
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">Admin has full access to all features and cannot be restricted. Manage permissions for Manager, Sales, and Viewer roles below.</p>
      </div>

      {/* Permissions matrix */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-6 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">Permission</div>
          {(['Admin','Manager','Sales','Viewer'] as const).map((r) => (
            <div key={r} className="text-center">
              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[r]}`}>{r}</span>
            </div>
          ))}
        </div>

        {PERM_LABELS.map((label, idx) => (
          <div key={label} className="grid grid-cols-6 px-6 py-3 border-b border-slate-50 last:border-0 items-center hover:bg-slate-50 transition-colors">
            <div className="col-span-2 text-sm text-slate-700">{label}</div>
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
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 hover:border-blue-400'}`}
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
  );
}
