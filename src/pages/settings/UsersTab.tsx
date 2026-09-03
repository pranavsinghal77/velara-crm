import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { useCrmStore } from '../../store/useCrmStore';

import { UserPlus, Pencil, MoreVertical, X } from 'lucide-react';

import type { User } from '../../types/models';
import { Toggle } from './shared';

const ROLE_BADGE: Record<string, string> = {
  Admin: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Sales: 'bg-green-100 text-green-700',
  Viewer: 'bg-gray-100 text-gray-700',
};

const PERMISSION_LABELS = [
  'View Leads', 'Add/Edit Leads', 'Delete Leads', 'View Inbox',
  'Send Messages', 'View Analytics', 'Manage Settings', 'Export Data',
] as const;

/** Stable keys sent to the API; the labels above are display-only. */
const PERMISSION_KEYS = [
  'leads:read', 'leads:write', 'leads:delete', 'inbox:read',
  'inbox:write', 'analytics:read', 'settings:write', 'data:export',
] as const;

const EMPTY_FORM = {
  name: '',
  email: '',
  role: 'Sales' as User['role'],
  password: '',
  permissions: [true, true, false, true, true, true, false, false],
};

export default function UsersTab() {
  const currentUser = useCrmStore((s) => s.currentUser);
  const users = useCrmStore((s) => s.users);
  const addUser = useCrmStore((s) => s.addUser);
  const toggleUserActive = useCrmStore((s) => s.toggleUserActive);
  
  const [inviteModal, setInviteModal] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_FORM);

  function toggleActive(id: string) { toggleUserActive(id); }

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  /**
   * The id, the active flag and the password hash are the server's business.
   * This used to build a whole `User` client-side (password included) and push
   * it optimistically into the list even when the API rejected it.
   */
  async function handleSaveInvite() {
    if (!userForm.name.trim() || !userForm.email.trim()) {
      setFormError('Name and email are required.');
      return;
    }
    if (userForm.password.length < 12) {
      setFormError('Temporary password must be at least 12 characters.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      await addUser({
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        password: userForm.password,
        role: userForm.role,
        permissions: PERMISSION_KEYS.filter((_, i) => userForm.permissions[i]),
      });
      setInviteModal(false);
      setUserForm(EMPTY_FORM);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not invite the member.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
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
          // The member's actual grants. This column used to render the same
          // hardcoded five chips for every row regardless of permissions.
          const perms = u.permissions.length > 0 ? u.permissions : ['none'];
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
                <div className="flex flex-wrap gap-1" title={u.permissions.join(', ')}>
                  {perms.slice(0, 3).map((p) => (
                    <span key={p} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{p}</span>
                  ))}
                  {perms.length > 3 && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">+{perms.length - 3} more</span>
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
      
      {/* ═══ INVITE MODAL ══════════════════════════════════ */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setInviteModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">Invite Team Member</h3>
              <button onClick={() => setInviteModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
            </div>

            {formError && (
              <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {formError}
              </div>
            )}

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
                <label className="text-xs font-semibold text-gray-700 block mb-1">Temporary password * (min 12 chars)</label>
                <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Permissions */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">Initial Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {PERMISSION_LABELS.map((p, i) => (
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
              <button
                onClick={() => void handleSaveInvite()}
                disabled={isSaving}
                className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70"
              >
                {isSaving ? 'Inviting...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
