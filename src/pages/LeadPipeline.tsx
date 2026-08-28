import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Download,
  LayoutGrid,
  List,
  Phone,
  MessageSquare,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Building,
  MapPin,
  IndianRupee,
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import type { Lead } from '../types/models';

import LeadTable from './pipeline/LeadTable';
import LeadFormModal from './pipeline/LeadFormModal';
import LeadViewModal from './pipeline/LeadViewModal';
import { SOURCES, STATUSES, PER_PAGE, sourceBase, today, emptyLead } from './pipeline/types';

const KANBAN_STAGES: Array<{ id: Lead['status']; label: string; color: string; bg: string }> = [
  { id: 'New', label: 'New Inquiries', color: 'border-blue-500 text-blue-700', bg: 'bg-blue-50/70' },
  { id: 'Contacted', label: 'Contacted', color: 'border-indigo-500 text-indigo-700', bg: 'bg-indigo-50/70' },
  { id: 'Qualified', label: 'Qualified', color: 'border-purple-500 text-purple-700', bg: 'bg-purple-50/70' },
  { id: 'Negotiation', label: 'Negotiation', color: 'border-amber-500 text-amber-700', bg: 'bg-amber-50/70' },
  { id: 'Won', label: 'Won / Closed', color: 'border-emerald-500 text-emerald-700', bg: 'bg-emerald-50/70' },
];

const SOURCE_BADGES: Record<string, string> = {
  JustDial: 'bg-blue-100 text-blue-700 border-blue-200',
  IndiaMART: 'bg-orange-100 text-orange-700 border-orange-200',
  Website: 'bg-green-100 text-green-700 border-green-200',
  WhatsApp: 'bg-teal-100 text-teal-700 border-teal-200',
  Referral: 'bg-purple-100 text-purple-700 border-purple-200',
};

export default function LeadPipeline() {
  const leads = useCrmStore((s) => s.leads);
  const addLead = useCrmStore((s) => s.addLead);
  const setLeads = useCrmStore((s) => s.setLeads);
  const updateLead = useCrmStore((s) => s.updateLead);
  const deleteLead = useCrmStore((s) => s.deleteLead);

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
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

  // ── filtering ────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = leads;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.company && l.company.toLowerCase().includes(q))
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

  // ── total pipeline value ─────────────────────────────────
  const pipelineValueLakhs = useMemo(() => {
    return leads.reduce((sum, l) => {
      if (!l.budget) return sum + 2;
      const num = parseFloat(l.budget.replace(/[^0-9.]/g, ''));
      return sum + (isNaN(num) ? 2 : num);
    }, 0);
  }, [leads]);

  // ── AI score preview ─────────────────────────────────────
  function calcScore(f: typeof form) {
    const base = sourceBase[f.source] ?? 70;
    let bonus = 0;
    if (f.company) bonus += 5;
    if (f.designation) bonus += 3;
    if (f.budget) bonus += 5;
    return Math.min(99, base + bonus);
  }

  // ── Move lead to next stage ──────────────────────────────
  function advanceStage(lead: Lead) {
    const order: Lead['status'][] = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won'];
    const idx = order.indexOf(lead.status);
    if (idx >= 0 && idx < order.length - 1) {
      updateLead(lead.id, { status: order[idx + 1] });
    }
  }

  // ── CRUD ─────────────────────────────────────────────────
  function openAdd() {
    setForm(emptyLead());
    setShowAdd(true);
  }

  function openEdit(lead: Lead) {
    setForm({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      company: lead.company ?? '',
      designation: lead.designation ?? '',
      city: lead.city ?? '',
      budget: lead.budget ?? '',
      source: lead.source,
      status: lead.status,
      notes: lead.notes,
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
      name: form.name,
      phone: form.phone,
      email: form.email,
      source: form.source as Lead['source'],
      status: form.status as Lead['status'],
      aiScore: score,
      aiScoreBreakdown: { sourceQuality: base, recency: 35, profileCompleteness: bonus },
      lastContact: today(),
      isHot: score > 75,
      tags: form.budget ? ['High Value'] : [],
      notes: form.notes,
      assignedTo: form.assignedTo || 'Sneha Kapoor',
      createdAt: today(),
      company: form.company || undefined,
      designation: form.designation || undefined,
      city: form.city || undefined,
      budget: form.budget || undefined,
    };

    addLead(newLead);
    setShowAdd(false);
  }

  function handleUpdate() {
    if (!editId) return;
    const score = calcScore(form);
    const base = sourceBase[form.source] ?? 70;
    const bonus = score - base;
    updateLead(editId, {
      name: form.name,
      phone: form.phone,
      email: form.email,
      source: form.source as Lead['source'],
      status: form.status as Lead['status'],
      aiScore: score,
      aiScoreBreakdown: { sourceQuality: base, recency: 35, profileCompleteness: bonus },
      isHot: score > 75,
      notes: form.notes,
      assignedTo: form.assignedTo,
      company: form.company || undefined,
      designation: form.designation || undefined,
      city: form.city || undefined,
      budget: form.budget || undefined,
    });
    setEditId(null);
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteLead(deleteId);
    setDeleteId(null);
    setSelected((s) => {
      const n = new Set(s);
      n.delete(deleteId);
      return n;
    });
  }

  function handleBulkDelete() {
    setLeads(leads.filter((l) => !selected.has(l.id)));
    setSelected(new Set());
  }

  function handleExport() {
    const rows = filtered.filter((l) => selected.size === 0 || selected.has(l.id));
    const header = 'Name,Phone,Email,Company,Source,Status,AI Score,City,Budget\n';
    const csv =
      header +
      rows
        .map((l) =>
          [
            l.name,
            l.phone,
            l.email,
            l.company ?? '',
            l.source,
            l.status,
            l.aiScore,
            l.city ?? '',
            l.budget ?? '',
          ].join(',')
        )
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'velara_leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleAll() {
    if (paged.every((l) => selected.has(l.id))) {
      setSelected((s) => {
        const n = new Set(s);
        paged.forEach((l) => n.delete(l.id));
        return n;
      });
    } else {
      setSelected((s) => {
        const n = new Set(s);
        paged.forEach((l) => n.add(l.id));
        return n;
      });
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

  const viewLead = viewId ? leads.find((l) => l.id === viewId) || null : null;

  return (
    <div className="space-y-5 p-6">
      {/* ═══ HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Lead Pipeline & Deal Desk</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
              {filtered.length} Leads
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <IndianRupee size={12} />
              ₹{pipelineValueLakhs.toFixed(1)}L Pipeline
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Omnichannel Indian B2B pipeline with IndiaMART/JustDial ingestion and AI scoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === 'kanban' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid size={14} />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List size={14} />
              Table
            </button>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
          >
            <Plus size={16} /> Add Lead
          </button>
        </div>
      </div>

      {/* ═══ FILTERS ══════════════════════════════════════════ */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, company, phone, email..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        <select
          value={fSource}
          onChange={(e) => {
            setFSource(e.target.value);
            setPage(1);
          }}
          className="text-xs px-3 py-2 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium"
        >
          <option value="">All Sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={fStatus}
          onChange={(e) => {
            setFStatus(e.target.value);
            setPage(1);
          }}
          className="text-xs px-3 py-2 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={fScore}
          onChange={(e) => {
            setFScore(e.target.value);
            setPage(1);
          }}
          className="text-xs px-3 py-2 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium"
        >
          <option value="">All AI Scores</option>
          <option value="hot">🔥 Hot (Above 75)</option>
          <option value="warm">⚡ Warm (50–75)</option>
          <option value="cold">❄️ Cold (Below 50)</option>
        </select>
      </div>

      {/* ═══ KANBAN VIEW ══════════════════════════════════════ */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {KANBAN_STAGES.map((stage) => {
            const stageLeads = filtered.filter((l) => l.status === stage.id);
            const stageValue = stageLeads.reduce((sum, l) => {
              const num = parseFloat((l.budget || '2').replace(/[^0-9.]/g, ''));
              return sum + (isNaN(num) ? 2 : num);
            }, 0);

            return (
              <div key={stage.id} className="glass-panel bg-slate-50/50 rounded-2xl p-3 flex flex-col min-w-[250px]">
                {/* Stage Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stage.id === 'Won' ? 'bg-emerald-500' : stage.id === 'Negotiation' ? 'bg-amber-500' : stage.id === 'Qualified' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                    <h3 className="font-bold text-xs text-gray-800 tracking-wide">{stage.label}</h3>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Stage Total Value */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-1 mb-2">
                  <span>Stage Value:</span>
                  <span className="font-bold text-slate-700">₹{stageValue.toFixed(1)}L</span>
                </div>

                {/* Lead Cards */}
                <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-320px)] pr-1">
                  {stageLeads.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                      No leads in this stage
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="bg-white/80 backdrop-blur-sm rounded-xl p-3.5 border border-slate-200 shadow-sm card-hover group"
                      >
                        {/* Top: Name & AI Score */}
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => setViewId(lead.id)}
                            className="font-bold text-xs text-gray-900 hover:text-blue-600 text-left line-clamp-1"
                          >
                            {lead.name}
                          </button>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border ${
                            lead.aiScore > 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : lead.aiScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            ⚡ {lead.aiScore}
                          </span>
                        </div>

                        {/* Company / City */}
                        <div className="mt-1 text-[11px] text-gray-500 flex items-center gap-2">
                          {lead.company && (
                            <span className="flex items-center gap-1 truncate font-medium">
                              <Building size={11} className="shrink-0 text-slate-400" />
                              {lead.company}
                            </span>
                          )}
                          {lead.city && (
                            <span className="flex items-center gap-0.5 truncate text-slate-400">
                              <MapPin size={10} className="shrink-0" />
                              {lead.city}
                            </span>
                          )}
                        </div>

                        {/* Source Badge & Budget */}
                        <div className="mt-2.5 flex items-center justify-between gap-1 text-[10px]">
                          <span className={`px-2 py-0.5 rounded-full font-semibold border ${SOURCE_BADGES[lead.source] || 'bg-gray-100 text-gray-700'}`}>
                            {lead.source}
                          </span>
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded font-mono">
                            {lead.budget || '₹2L'}
                          </span>
                        </div>

                        {/* Card Actions Footer */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-[10px] text-slate-400 truncate max-w-[90px]">
                            {lead.assignedTo || 'Unassigned'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(lead)}
                              className="text-[10px] text-slate-600 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-slate-100"
                            >
                              Edit
                            </button>
                            {stage.id !== 'Won' && (
                              <button
                                onClick={() => advanceStage(lead)}
                                className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px] font-bold transition-colors"
                                title="Move to next stage"
                              >
                                Move <ArrowRight size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ═══ TABLE VIEW ═══════════════════════════════════════ */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {selected.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 border-b border-blue-200 text-xs">
              <span className="font-semibold text-blue-800">{selected.size} selected</span>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-semibold"
              >
                <Trash2 size={12} /> Delete Selected
              </button>
            </div>
          )}

        <LeadTable
          paged={paged}
          selected={selected}
          toggleAll={toggleAll}
          toggleOne={toggleOne}
          setViewId={setViewId}
          openEdit={openEdit}
          setDeleteId={setDeleteId}
          filteredLength={filtered.length}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
        />
        </div>
      )}

      {/* ═══ MODALS ═══════════════════════════════════════════ */}
      <LeadFormModal
        showAdd={showAdd}
        editId={editId}
        setShowAdd={setShowAdd}
        setEditId={setEditId}
        form={form}
        setForm={setForm}
        handleSave={handleSave}
        handleUpdate={handleUpdate}
        calcScore={calcScore}
      />

      <LeadViewModal
        viewLead={viewLead}
        setViewId={setViewId}
        openEdit={openEdit}
      />

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl border border-gray-200">
            <h3 className="font-bold text-gray-900 text-sm">Delete Lead</h3>
            <p className="text-xs text-gray-600">Are you sure you want to delete this lead from the pipeline and database?</p>
            <div className="flex justify-end gap-2 text-xs">
              <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 border border-gray-200 rounded hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 font-bold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
