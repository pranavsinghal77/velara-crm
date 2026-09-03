import React from 'react';
import { X } from 'lucide-react';
import type { Lead } from '../../types/models';
import { SOURCES, STATUSES, scoreColor } from './types';

interface LeadFormModalProps {
  showAdd: boolean;
  editId: string | null;
  setShowAdd: (v: boolean) => void;
  setEditId: (v: string | null) => void;
  form: ReturnType<typeof import('./types').emptyLead>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof import('./types').emptyLead>>>;
  handleSave: () => void;
  handleUpdate: () => void;
  calcScore: (f: ReturnType<typeof import('./types').emptyLead>) => number;
}

export default function LeadFormModal({
  showAdd,
  editId,
  setShowAdd,
  setEditId,
  form,
  setForm,
  handleSave,
  handleUpdate,
  calcScore,
}: LeadFormModalProps) {
  if (!showAdd && !editId) return null;

  const inp = (label: string, key: keyof typeof form, type = 'text', required = false, placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{editId ? 'Edit Lead' : 'Add New Lead'}</h2>
          <button
            onClick={() => {
              setShowAdd(false);
              setEditId(null);
            }}
            className="p-1 rounded-lg hover:bg-slate-100"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inp('Full Name', 'name', 'text', true, 'Rajesh Kumar')}
            {inp('Phone', 'phone', 'tel', true, '+91 98765 43210')}
            {inp('Email', 'email', 'email', true, 'rajesh@example.com')}
            {inp('Company', 'company', 'text', false, 'Kumar Enterprises')}
            {inp('Designation', 'designation', 'text', false, 'Director')}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Source <span className="text-red-500">*</span>
              </label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as Lead['source'] })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Lead['status'] })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {inp('City', 'city', 'text', false, 'Mumbai')}
            {inp('Budget', 'budget', 'text', false, '₹5L')}
            {inp('Assign To', 'assignedTo', 'text', false, 'Sneha Kapoor')}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Add notes about this lead..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* AI Score Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
            <span
              className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-bold ${scoreColor(
                calcScore(form)
              )}`}
            >
              {calcScore(form)}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800">Estimated AI Score: {calcScore(form)}/100</p>
              <p className="text-xs text-slate-500">Based on source quality and profile completeness</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button
            onClick={() => {
              setShowAdd(false);
              setEditId(null);
            }}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={editId ? handleUpdate : handleSave}
            disabled={!form.name || !form.phone || !form.email}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {editId ? 'Update Lead' : 'Save Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
