import { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Bell,
  Sparkles,
  Clock,
  Flame,
  Trophy,
  Calendar,
  CheckCircle,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { getReminders, saveReminders } from '../types/index';
import type { Reminder } from '../types/index';

// ─── helpers ──────────────────────────────────────────────────────────────────

function isToday(d: string) {
  return new Date(d).toDateString() === new Date().toDateString();
}
function isTomorrow(d: string) {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return new Date(d).toDateString() === t.toDateString();
}
function isOverdue(r: Reminder) {
  if (r.isCompleted) return false;
  const due = new Date(`${r.dueDate}T${r.dueTime}`);
  return due < new Date();
}

type Tab = 'All' | 'Due Today' | 'Tomorrow' | 'Upcoming' | 'Completed';
const TABS: Tab[] = ['All', 'Due Today', 'Tomorrow', 'Upcoming', 'Completed'];

const priorityBorder: Record<string, string> = { High: 'border-l-red-500', Medium: 'border-l-amber-500', Low: 'border-l-blue-500' };
const priorityBadge: Record<string, string> = { High: 'bg-red-100 text-red-700', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-blue-100 text-blue-700' };

const EMPTY_FORM = { leadName: '', task: '', dueDate: new Date().toISOString().split('T')[0], dueTime: '10:00', priority: 'Medium' as Reminder['priority'], type: 'Manual' as Reminder['type'], notes: '' };

// ─── component ────────────────────────────────────────────────────────────────

export default function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>(() => getReminders());
  const [tab, setTab] = useState<Tab>('All');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState('');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calDate, setCalDate] = useState<string | null>(null);

  // toast auto-dismiss
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2000); return () => clearTimeout(t); } }, [toast]);

  // ── stats ─────────────────────────────────────────────────
  const dueTodayCount = reminders.filter((r) => isToday(r.dueDate) && !r.isCompleted).length;
  const dueTomorrowCount = reminders.filter((r) => isTomorrow(r.dueDate) && !r.isCompleted).length;
  const upcomingCount = reminders.filter((r) => !isToday(r.dueDate) && !isTomorrow(r.dueDate) && !r.isCompleted && new Date(r.dueDate) >= new Date()).length;

  // ── filtered list ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = reminders;
    if (calDate) list = list.filter((r) => r.dueDate === calDate);
    switch (tab) {
      case 'Due Today': return list.filter((r) => isToday(r.dueDate) && !r.isCompleted);
      case 'Tomorrow': return list.filter((r) => isTomorrow(r.dueDate) && !r.isCompleted);
      case 'Upcoming': return list.filter((r) => !isToday(r.dueDate) && !isTomorrow(r.dueDate) && !r.isCompleted && new Date(r.dueDate) >= new Date());
      case 'Completed': return list.filter((r) => r.isCompleted);
      default: return list;
    }
  }, [reminders, tab, calDate]);

  // ── week overview ─────────────────────────────────────────
  const completedCount = reminders.filter((r) => r.isCompleted).length;
  const aiCount = reminders.filter((r) => r.type === 'AI-Generated').length;
  const overdueCount = reminders.filter(isOverdue).length;

  const recentCompleted = reminders.filter((r) => r.isCompleted).slice(-3).reverse();

  // ── calendar helpers ──────────────────────────────────────
  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1);
    const start = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(start).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calMonth, calYear]);

  const reminderDateSet = useMemo(() => {
    const m = new Map<string, string>();
    reminders.filter((r) => !r.isCompleted).forEach((r) => {
      const key = r.dueDate;
      if (isToday(key)) m.set(key, 'red');
      else if (isTomorrow(key)) { if (!m.has(key)) m.set(key, 'amber'); }
      else { if (!m.has(key)) m.set(key, 'blue'); }
    });
    return m;
  }, [reminders]);

  function dateStr(day: number) {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // ── CRUD ──────────────────────────────────────────────────
  function persist(next: Reminder[]) { saveReminders(next); setReminders(next); }

  function handleComplete(id: string) {
    persist(reminders.map((r) => (r.id === id ? { ...r, isCompleted: true } : r)));
    setToast('✓ Reminder marked complete');
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this reminder?')) return;
    persist(reminders.filter((r) => r.id !== id));
  }

  function openEdit(r: Reminder) {
    setEditId(r.id);
    setForm({ leadName: r.leadName, task: r.task, dueDate: r.dueDate, dueTime: r.dueTime, priority: r.priority, type: r.type, notes: '' });
    setShowModal(true);
  }

  function handleSave() {
    if (!form.leadName.trim() || !form.task.trim() || !form.dueDate || !form.dueTime) return;
    if (editId) {
      persist(reminders.map((r) => (r.id === editId ? { ...r, leadName: form.leadName, task: form.task, dueDate: form.dueDate, dueTime: form.dueTime, priority: form.priority, type: form.type, isToday: isToday(form.dueDate), isTomorrow: isTomorrow(form.dueDate) } : r)));
    } else {
      const newR: Reminder = {
        id: 'rem_' + Date.now(),
        leadId: '',
        leadName: form.leadName,
        task: form.task,
        dueDate: form.dueDate,
        dueTime: form.dueTime,
        isToday: isToday(form.dueDate),
        isTomorrow: isTomorrow(form.dueDate),
        isCompleted: false,
        priority: form.priority,
        type: form.type,
      };
      persist([...reminders, newR]);
    }
    setShowModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  // ── render ────────────────────────────────────────────────
  const todayStr = new Date().toDateString();

  return (
    <div className="p-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* ═══ HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Reminders & Follow-ups</h1>
        <button onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Add Reminder
        </button>
      </div>

      {/* stat pills */}
      <div className="flex gap-2">
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-700">{dueTodayCount} Due Today</span>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700">{dueTomorrowCount} Tomorrow</span>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">{upcomingCount} Upcoming</span>
      </div>

      {/* ═══ TWO COLUMNS ═════════════════════════════════════ */}
      <div className="flex gap-5">
        {/* ─── LEFT 65% ──────────────────────────────────────── */}
        <div className="w-[65%] space-y-6 min-w-0">

          {/* Section A: Active Reminders */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bell size={18} className="text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900">Active Reminders</h2>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 mb-4 flex-wrap">
              {TABS.map((t) => (
                <button key={t} onClick={() => { setTab(t); setCalDate(null); }} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${tab === t ? 'bg-[#2563EB] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Reminder cards */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <CheckCircle size={44} className="text-green-400 mb-3" />
                <h3 className="text-base font-semibold text-gray-700">All caught up!</h3>
                <p className="text-sm text-gray-400">No pending reminders.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((r) => {
                  const completed = r.isCompleted;
                  const dueLabel = isToday(r.dueDate) ? 'DUE TODAY' : isTomorrow(r.dueDate) ? 'TOMORROW' : new Date(r.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                  const dueLabelColor = isToday(r.dueDate) ? 'bg-red-100 text-red-700' : isTomorrow(r.dueDate) ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';
                  return (
                    <div key={r.id} className={`flex items-start gap-3 bg-white rounded-xl shadow-sm border border-gray-100 p-4 border-l-4 ${completed ? 'border-l-green-400 opacity-60' : priorityBorder[r.priority]}`}>
                      {/* checkbox */}
                      <div className="pt-0.5 shrink-0">
                        {completed ? (
                          <CheckCircle size={20} className="text-green-500" />
                        ) : (
                          <button onClick={() => handleComplete(r.id)} className="w-5 h-5 rounded border-2 border-gray-300 hover:border-blue-500 transition-colors" />
                        )}
                      </div>
                      {/* info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{r.task}</p>
                        <p className="text-xs text-blue-600 mt-0.5 cursor-pointer hover:underline">{r.leadName}</p>
                        <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.type === 'AI-Generated' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{r.type}</span>
                      </div>
                      {/* right meta */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                        {completed ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Completed</span>
                        ) : (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dueLabelColor}`}>{dueLabel}</span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          <Clock size={12} /> {r.dueTime}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityBadge[r.priority]}`}>{r.priority}</span>
                        {!completed && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section B: AI Follow-up Rules */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-[#7C3AED]" />
              <h2 className="text-lg font-bold text-gray-900">AI Follow-up Rules</h2>
            </div>
            <p className="text-xs text-gray-400 mb-3">Velara AI automatically creates reminders based on these rules</p>

            <div className="space-y-3">
              {([
                { icon: <Clock size={20} className="text-amber-500" />, title: 'No Contact Rule', desc: "If a lead hasn't been contacted in 3 days, AI creates a High priority follow-up reminder automatically" },
                { icon: <Flame size={20} className="text-red-500" />, title: 'HOT Lead Alert', desc: 'HOT leads not followed up within 24 hours trigger an instant priority reminder for the assigned rep' },
                { icon: <Trophy size={20} className="text-green-500" />, title: 'Post-Meeting Follow-up', desc: 'After logging a meeting or call, AI schedules a follow-up reminder for 2 business days later' },
              ] as const).map((rule) => (
                <div key={rule.title} className="flex items-start gap-3 bg-purple-50 rounded-xl p-4">
                  <div className="shrink-0 mt-0.5">{rule.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-800">{rule.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{rule.desc}</p>
                  </div>
                  <div className="shrink-0">
                    <div className="w-10 h-5 rounded-full bg-green-500 relative cursor-pointer">
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white shadow" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT 35% ─────────────────────────────────────── */}
        <div className="w-[35%] space-y-5 min-w-0">

          {/* Section A: Calendar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-600" />
                <h3 className="text-sm font-bold text-gray-900">Calendar</h3>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronLeft size={16} /></button>
                <span className="text-xs font-semibold text-gray-700 w-24 text-center">{new Date(calYear, calMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-gray-400 mb-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}
            </div>
            <div className="grid grid-cols-7 text-center gap-y-0.5">
              {calDays.map((d, i) => {
                if (d === null) return <span key={i} />;
                const ds = dateStr(d);
                const isTod = new Date(ds).toDateString() === todayStr;
                const dotColor = reminderDateSet.get(ds);
                const isSelected = calDate === ds;
                return (
                  <button
                    key={i}
                    onClick={() => { setCalDate(calDate === ds ? null : ds); setTab('All'); }}
                    className={`relative flex flex-col items-center py-1 rounded-lg text-xs transition-colors ${
                      isTod ? 'bg-[#2563EB] text-white font-bold' : isSelected ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {d}
                    {dotColor && (
                      <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${dotColor === 'red' ? 'bg-red-500' : dotColor === 'amber' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section B: Quick Stats */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2">This Week's Overview</h3>
            <div className="grid grid-cols-2 gap-2">
              {([
                { label: 'Reminders Set', val: reminders.length, color: 'text-blue-600 bg-blue-50' },
                { label: 'Completed', val: completedCount, color: 'text-green-600 bg-green-50' },
                { label: 'AI Generated', val: aiCount, color: 'text-purple-600 bg-purple-50' },
                { label: 'Overdue', val: overdueCount, color: 'text-red-600 bg-red-50' },
              ] as const).map((s) => (
                <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
                  <p className="text-xl font-bold">{s.val}</p>
                  <p className="text-[11px] font-medium opacity-80">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section C: Recent Completions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-green-500" />
              <h3 className="text-sm font-bold text-gray-900">Recently Completed</h3>
            </div>
            {recentCompleted.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No completed reminders yet.</p>
            ) : (
              <div className="space-y-2">
                {recentCompleted.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <CheckCircle size={14} className="text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700 truncate">{r.leadName} — {r.task}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">Completed</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ ADD / EDIT MODAL ════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">{editId ? 'Edit Reminder' : 'Add New Reminder'}</h3>
              <button onClick={() => { setShowModal(false); setEditId(null); }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>

            {/* body */}
            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-gray-700">Lead Name *</label>
                <input type="text" value={form.leadName} onChange={(e) => setForm({ ...form, leadName: e.target.value })} placeholder="Search lead…" className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Task Description *</label>
                <textarea rows={2} value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} placeholder="Follow up on…" className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Due Date *</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Due Time *</label>
                  <input type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Priority *</label>
                <div className="flex gap-3 mt-1">
                  {(['High', 'Medium', 'Low'] as const).map((p) => (
                    <label key={p} className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-lg border transition-colors ${form.priority === p ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <input type="radio" name="priority" checked={form.priority === p} onChange={() => setForm({ ...form, priority: p })} className="sr-only" />{p}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Type</label>
                <div className="flex gap-3 mt-1">
                  {(['Manual', 'AI-Generated'] as const).map((t) => (
                    <label key={t} className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-lg border transition-colors ${form.type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <input type="radio" name="type" checked={form.type === t} onChange={() => setForm({ ...form, type: t })} className="sr-only" />{t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes…" className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <button onClick={() => { setShowModal(false); setEditId(null); }} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors">Save Reminder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
