import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Flame,
} from 'lucide-react';
import { getLeads, saveLeads } from '../types/index';
import type { Lead } from '../types/index';

// ─── constants ────────────────────────────────────────────────────────────────

const SOURCES: Lead['source'][] = ['JustDial', 'IndiaMART', 'Website', 'WhatsApp', 'Referral'];
const STATUSES: Lead['status'][] = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost'];
const PER_PAGE = 8;

const sourceBase: Record<string, number> = {
  Referral: 90, JustDial: 85, IndiaMART: 80, Website: 70, WhatsApp: 65,
};

const sourceBadge: Record<string, string> = {
  JustDial: 'bg-blue-100 text-blue-700',
  IndiaMART: 'bg-orange-100 text-orange-700',
  Website: 'bg-green-100 text-green-700',
  WhatsApp: 'bg-teal-100 text-teal-700',
  Referral: 'bg-purple-100 text-purple-700',
};

const statusBadge: Record<string, { bg: string; dot: string }> = {
  New: { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  Contacted: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  Qualified: { bg: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  Negotiation: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  Won: { bg: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  Lost: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

function scoreColor(s: number) {
  if (s > 75) return 'text-green-600 border-green-500';
  if (s >= 50) return 'text-orange-600 border-orange-500';
  return 'text-red-600 border-red-500';
}

function daysSince(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

type Prediction = {
  label: string;
  cls: string;
  tip: string;
};

function getPrediction(score: number, status: Lead['status']): Prediction {
  if (status === 'Won')
    return { label: '✅ Closed Won', cls: 'bg-green-100 text-green-700', tip: 'Deal successfully closed!' };
  if (status === 'Lost')
    return { label: '❌ Lost', cls: 'bg-red-100 text-red-600', tip: 'Mark reasons & archive lead.' };
  if (score > 80 && (status === 'Qualified' || status === 'Negotiation'))
    return { label: '🎯 Close in 7d', cls: 'bg-green-100 text-green-700', tip: 'Send final proposal + pricing sheet' };
  if (score > 70 && status === 'Contacted')
    return { label: '📈 High Potential', cls: 'bg-blue-100 text-blue-700', tip: 'Schedule demo call this week' };
  if (score > 60 && status === 'New')
    return { label: '👀 Needs Nurturing', cls: 'bg-amber-100 text-amber-700', tip: 'Add to WhatsApp drip campaign' };
  if (score < 50)
    return { label: '❄️ Cold Lead', cls: 'bg-gray-100 text-gray-600', tip: 'Re-engage with value content' };
  return { label: '📊 In Progress', cls: 'bg-indigo-100 text-indigo-700', tip: 'Continue regular follow-up' };
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyLead = (): Omit<Lead, 'id' | 'createdAt' | 'lastContact' | 'aiScore' | 'aiScoreBreakdown' | 'isHot' | 'tags'> => ({
  name: '', phone: '', email: '', company: '', designation: '', city: '', budget: '',
  source: 'JustDial', status: 'New', notes: '', assignedTo: '',
});

// ─── component ────────────────────────────────────────────────────────────────

export default function LeadPipeline() {
  const [leads, setLeads] = useState<Lead[]>(() => getLeads());
  const [search, setSearch] = useState('');
  const [fSource, setFSource] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fScore, setFScore] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // modals
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // form state
  const [form, setForm] = useState(emptyLead());

  // ── persist helper ───────────────────────────────────────
  const persist = useCallback((next: Lead[]) => {
    saveLeads(next);
    setLeads(next);
  }, []);

  // ── filtering ────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = leads;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          l.email.toLowerCase().includes(q),
      );
    }
    if (fSource) list = list.filter((l) => l.source === fSource);
    if (fStatus) list = list.filter((l) => l.status === fStatus);
    if (fScore === 'hot') list = list.filter((l) => l.aiScore > 75);
    else if (fScore === 'warm') list = list.filter((l) => l.aiScore >= 50 && l.aiScore <= 75);
    else if (fScore === 'cold') list = list.filter((l) => l.aiScore < 50);
    return list;
  }, [leads, search, fSource, fStatus, fScore]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── AI score preview ─────────────────────────────────────
  function calcScore(f: typeof form) {
    const base = sourceBase[f.source] ?? 70;
    let bonus = 0;
    if (f.company) bonus += 5;
    if (f.designation) bonus += 3;
    if (f.budget) bonus += 5;
    return Math.min(99, base + bonus);
  }

  // ── CRUD ─────────────────────────────────────────────────
  function openAdd() {
    setForm(emptyLead());
    setShowAdd(true);
  }
  function openEdit(lead: Lead) {
    setForm({
      name: lead.name, phone: lead.phone, email: lead.email,
      company: lead.company ?? '', designation: lead.designation ?? '',
      city: lead.city ?? '', budget: lead.budget ?? '',
      source: lead.source, status: lead.status, notes: lead.notes,
      assignedTo: lead.assignedTo,
    });
    setEditId(lead.id);
  }

  function handleSave() {
    const score = calcScore(form);
    const base = sourceBase[form.source] ?? 70;
    const bonus = score - base;
    const newLead: Lead = {
      id: 'lead_' + Date.now(),
      name: form.name, phone: form.phone, email: form.email,
      source: form.source as Lead['source'],
      status: form.status as Lead['status'],
      aiScore: score,
      aiScoreBreakdown: { sourceQuality: base, recency: 35, profileCompleteness: bonus },
      lastContact: today(), isHot: score > 75,
      tags: [], notes: form.notes, assignedTo: form.assignedTo, createdAt: today(),
      company: form.company || undefined, designation: form.designation || undefined,
      city: form.city || undefined, budget: form.budget || undefined,
    };
    persist([...leads, newLead]);
    setShowAdd(false);
  }

  function handleUpdate() {
    if (!editId) return;
    const score = calcScore(form);
    const base = sourceBase[form.source] ?? 70;
    const bonus = score - base;
    const next = leads.map((l) =>
      l.id === editId
        ? {
            ...l,
            name: form.name, phone: form.phone, email: form.email,
            source: form.source as Lead['source'],
            status: form.status as Lead['status'],
            aiScore: score,
            aiScoreBreakdown: { sourceQuality: base, recency: 35, profileCompleteness: bonus },
            isHot: score > 75, notes: form.notes, assignedTo: form.assignedTo,
            company: form.company || undefined, designation: form.designation || undefined,
            city: form.city || undefined, budget: form.budget || undefined,
          }
        : l,
    );
    persist(next);
    setEditId(null);
  }

  function handleDelete() {
    if (!deleteId) return;
    persist(leads.filter((l) => l.id !== deleteId));
    setDeleteId(null);
    setSelected((s) => { const n = new Set(s); n.delete(deleteId); return n; });
  }

  function handleBulkDelete() {
    persist(leads.filter((l) => !selected.has(l.id)));
    setSelected(new Set());
  }

  function handleExport() {
    const rows = filtered.filter((l) => selected.has(l.id));
    const header = 'Name,Phone,Email,Company,Source,Status,AI Score,City,Budget\n';
    const csv = header + rows.map((l) =>
      [l.name, l.phone, l.email, l.company ?? '', l.source, l.status, l.aiScore, l.city ?? '', l.budget ?? ''].join(','),
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'velara_leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── selection helpers ────────────────────────────────────
  function toggleAll() {
    if (paged.every((l) => selected.has(l.id))) {
      setSelected((s) => { const n = new Set(s); paged.forEach((l) => n.delete(l.id)); return n; });
    } else {
      setSelected((s) => { const n = new Set(s); paged.forEach((l) => n.add(l.id)); return n; });
    }
  }
  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  }

  const viewLead = viewId ? leads.find((l) => l.id === viewId) : null;

  // ── input helper ─────────────────────────────────────────
  const inp = (label: string, key: keyof typeof form, type = 'text', required = false, placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type} required={required} placeholder={placeholder}
        value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  // ── render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Lead Pipeline</h1>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
            {filtered.length} leads
          </span>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Add Lead
        </button>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, phone, email..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={fSource} onChange={(e) => { setFSource(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fScore} onChange={(e) => { setFScore(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Scores</option>
          <option value="hot">Hot &gt;75</option>
          <option value="warm">Warm 50-75</option>
          <option value="cold">Cold &lt;50</option>
        </select>
      </div>

      {/* BULK ACTIONS */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-blue-700">{selected.size} selected</span>
          <button onClick={handleBulkDelete} className="text-xs font-medium px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
            Delete Selected
          </button>
          <button onClick={handleExport} className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="p-3 w-10">
                <input type="checkbox" checked={paged.length > 0 && paged.every((l) => selected.has(l.id))} onChange={toggleAll}
                  className="rounded border-gray-300" />
              </th>
              <th className="p-3 font-semibold text-gray-600">LEAD</th>
              <th className="p-3 font-semibold text-gray-600">CONTACT</th>
              <th className="p-3 font-semibold text-gray-600">SOURCE</th>
              <th className="p-3 font-semibold text-gray-600">STATUS</th>
              <th className="p-3 font-semibold text-gray-600">AI SCORE</th>
              <th className="p-3 font-semibold text-gray-600">AI PREDICTION</th>
              <th className="p-3 font-semibold text-gray-600">LAST CONTACT</th>
              <th className="p-3 font-semibold text-gray-600 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((l) => {
              const days = daysSince(l.lastContact);
              const prediction = getPrediction(l.aiScore, l.status);
              return (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleOne(l.id)} className="rounded border-gray-300" />
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-gray-900">{l.name}</p>
                    <p className="text-xs text-gray-400">{l.company ?? '—'}</p>
                  </td>
                  <td className="p-3">
                    <p className="text-gray-700">{l.phone}</p>
                    <p className="text-xs text-gray-400">{l.email}</p>
                  </td>
                  <td className="p-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sourceBadge[l.source]}`}>{l.source}</span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusBadge[l.status].bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusBadge[l.status].dot}`} />
                      {l.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full border-2 text-xs font-bold ${scoreColor(l.aiScore)}`}>
                        {l.aiScore}
                      </span>
                      {l.isHot && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                          <Flame size={12} /> HOT
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="group relative inline-block">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium cursor-default ${prediction.cls}`}>
                        {prediction.label}
                      </span>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                        <div className="bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                          {prediction.tip}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <p className="text-gray-700">{l.lastContact}</p>
                    <p className="text-xs text-gray-400">{days === 0 ? 'Today' : `${days}d ago`}</p>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewId(l.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"><Eye size={16} /></button>
                      <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-amber-600 transition-colors"><Pencil size={16} /></button>
                      <button onClick={() => setDeleteId(l.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">No leads found.</td></tr>
            )}
          </tbody>
        </table>

        {/* PAGINATION */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Showing {Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium text-gray-600 px-2">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════ ADD / EDIT MODAL ════════════════════ */}
      {(showAdd || editId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editId ? 'Edit Lead' : 'Add New Lead'}</h2>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inp('Full Name', 'name', 'text', true, 'Rajesh Kumar')}
                {inp('Phone', 'phone', 'tel', true, '+91 98765 43210')}
                {inp('Email', 'email', 'email', true, 'rajesh@example.com')}
                {inp('Company', 'company', 'text', false, 'Kumar Enterprises')}
                {inp('Designation', 'designation', 'text', false, 'Director')}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Source <span className="text-red-500">*</span></label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as Lead['source'] })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status <span className="text-red-500">*</span></label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Lead['status'] })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {inp('City', 'city', 'text', false, 'Mumbai')}
                {inp('Budget', 'budget', 'text', false, '₹5L')}
                {inp('Assign To', 'assignedTo', 'text', false, 'Sneha Kapoor')}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3} placeholder="Add notes about this lead..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* AI Score Preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-bold ${scoreColor(calcScore(form))}`}>
                  {calcScore(form)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Estimated AI Score: {calcScore(form)}/100</p>
                  <p className="text-xs text-gray-500">Based on source quality and profile completeness</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => { setShowAdd(false); setEditId(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={editId ? handleUpdate : handleSave}
                disabled={!form.name || !form.phone || !form.email}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {editId ? 'Update Lead' : 'Save Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ VIEW MODAL ═════════════════════════ */}
      {viewLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{viewLead.name}</h2>
                {viewLead.isHot && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    <Flame size={12} /> HOT
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center justify-center w-11 h-11 rounded-full border-2 text-sm font-bold ${scoreColor(viewLead.aiScore)}`}>
                  {viewLead.aiScore}
                </span>
                <button onClick={() => setViewId(null)} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} className="text-gray-500" /></button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-400 text-xs">Phone</p><p className="font-medium text-gray-800">{viewLead.phone}</p></div>
                <div><p className="text-gray-400 text-xs">Email</p><p className="font-medium text-gray-800">{viewLead.email}</p></div>
                <div><p className="text-gray-400 text-xs">Company</p><p className="font-medium text-gray-800">{viewLead.company ?? '—'}</p></div>
                <div><p className="text-gray-400 text-xs">Designation</p><p className="font-medium text-gray-800">{viewLead.designation ?? '—'}</p></div>
                <div><p className="text-gray-400 text-xs">City</p><p className="font-medium text-gray-800">{viewLead.city ?? '—'}</p></div>
                <div><p className="text-gray-400 text-xs">Budget</p><p className="font-medium text-gray-800">{viewLead.budget ?? '—'}</p></div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Source</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sourceBadge[viewLead.source]}`}>{viewLead.source}</span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Status</p>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusBadge[viewLead.status].bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge[viewLead.status].dot}`} />
                    {viewLead.status}
                  </span>
                </div>
                <div><p className="text-gray-400 text-xs">Assigned To</p><p className="font-medium text-gray-800">{viewLead.assignedTo || '—'}</p></div>
                <div><p className="text-gray-400 text-xs">Created</p><p className="font-medium text-gray-800">{viewLead.createdAt}</p></div>
              </div>

              {/* AI Score Breakdown */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">AI Score Breakdown</p>
                {(['sourceQuality', 'recency', 'profileCompleteness'] as const).map((k) => (
                  <div key={k} className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-semibold text-gray-700">{viewLead.aiScoreBreakdown[k]}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${(viewLead.aiScoreBreakdown[k] / 35) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {viewLead.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{viewLead.notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => { setViewId(null); openEdit(viewLead); }}
                className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">
                Edit Lead
              </button>
              <button onClick={() => setViewId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ DELETE CONFIRM ═════════════════════ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Lead</h3>
            <p className="text-sm text-gray-500 mb-5">Are you sure? This action cannot be undone.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
