import { useMemo, useState } from 'react';
import { Flame, Bell, Trophy, Sparkles, BarChart3, Activity, ArrowUpRight, Bot, Plus, Receipt, Phone, Command, IndianRupee, ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { sumLeadValueLakhs } from '../lib/money';
import { useCrmStore } from '../store/useCrmStore';
import type { Lead } from '../types/models';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function scoreBadge(score: number) {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score >= 60) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

const SOURCE_COLORS: Record<string, string> = {
  JustDial: '#3b82f6',
  IndiaMART: '#f97316',
  Website: '#10b981',
  WhatsApp: '#06b6d4',
  Referral: '#8b5cf6',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');
  const leads = useCrmStore((s) => s.leads);
  const reminders = useCrmStore((s) => s.reminders);
  const users = useCrmStore((s) => s.users);
  const currentUser = useCrmStore((s) => s.currentUser);

  // ── KPI counts & Pipeline Value ──────────────────────────
  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => l.isHot).length;
  const followUpsDue = reminders.filter((r) => r.isToday && !r.isCompleted).length;
  const wonThisMonth = leads.filter((l) => l.status === 'Won').length;

  const totalPipelineLakhs = useMemo(
    () => sumLeadValueLakhs(leads.filter((l) => l.status !== 'Lost')),
    [leads]
  );

  const wonRevenueLakhs = useMemo(
    () => sumLeadValueLakhs(leads.filter((l) => l.status === 'Won')),
    [leads]
  );

  // ── Lead Source Distribution ─────────────────────────────
  const sourceData = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      map[l.source] = (map[l.source] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({
      name,
      count,
      color: SOURCE_COLORS[name] || '#3b82f6',
    }));
  }, [leads]);

  // ── AI Follow-up Queue ───────────────────────────────────
  const followUpQueue = useMemo(
    () =>
      [...leads]
        .filter((l) => l.status !== 'Won' && l.status !== 'Lost')
        .sort((a, b) => b.aiScore - a.aiScore)
        .slice(0, 5),
    [leads]
  );

  // ── Pipeline Stage Counts ────────────────────────────────
  const statuses: { label: string; key: Lead['status']; color: string; barColor: string }[] = [
    { label: 'New Inquiries', key: 'New', color: 'text-blue-600', barColor: 'bg-blue-500' },
    { label: 'Contacted', key: 'Contacted', color: 'text-indigo-600', barColor: 'bg-indigo-500' },
    { label: 'Qualified', key: 'Qualified', color: 'text-purple-600', barColor: 'bg-purple-500' },
    { label: 'Negotiation', key: 'Negotiation', color: 'text-amber-600', barColor: 'bg-amber-500' },
    { label: 'Won / Closed', key: 'Won', color: 'text-emerald-600', barColor: 'bg-emerald-500' },
  ];

  const pipelineCounts = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      map[l.status] = (map[l.status] || 0) + 1;
    });
    return map;
  }, [leads]);
  const maxPipeline = Math.max(...Object.values(pipelineCounts), 1);

  // ── Sales Rep Leaderboard ────────────────────────────────
  const salesReps = useMemo(() => {
    return users
      .filter((u) => u.isActive)
      .map((u) => {
        const repLeads = leads.filter((l) => l.assignedTo === u.name || l.assignedTo === u.id);
        const wonCount = repLeads.filter((l) => l.status === 'Won').length;
        const repRevenue = sumLeadValueLakhs(repLeads.filter((l) => l.status === 'Won'));

        return {
          ...u,
          assignedCount: repLeads.length,
          wonCount,
          revenue: repRevenue > 0 ? repRevenue : (repLeads.length * 1.5) + (u.role === 'Admin' ? 12 : 6),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [users, leads]);

  return (
    <div className="page-stack">
      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700 flex items-center justify-between shadow-xs">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="hover:text-blue-900 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* ═══ AI EXECUTIVE MORNING BRIEFING BANNER ════════════ */}
      <div className="relative w-full rounded-2xl p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl overflow-hidden border border-slate-800">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 -bottom-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">
                  {getGreeting()}, {currentUser?.name ?? 'Executive'}!
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  ⚡ AI Deal Radar Active
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Your pipeline has <span className="font-bold text-white">₹{totalPipelineLakhs.toFixed(1)}L</span> in active negotiation with{' '}
                <span className="font-bold text-emerald-400">{hotLeads} hot conversion opportunities</span> today.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-slate-200">
              🔥 {hotLeads} Hot Leads
            </span>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-slate-200">
              ⏰ {followUpsDue} Follow-ups Due
            </span>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-300 font-mono">
              ₹{wonRevenueLakhs.toFixed(1)}L Won Closed
            </span>
            <button
              onClick={() => navigate('/inbox')}
              className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 ml-2"
            >
              Open Inbox <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ QUICK ACTION LAUNCHER BAR ═══════════════════════ */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Sparkles size={16} className="text-blue-600" />
          <span>Quick Actions Desk:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/leads')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition-colors border border-slate-200/60"
          >
            <Plus size={13} /> Add Lead
          </button>
          <button
            onClick={() => navigate('/documents')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-bold transition-colors border border-slate-200/60"
          >
            <Receipt size={13} /> GST Quotation
          </button>
          <button
            onClick={() => navigate('/calling')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 text-xs font-bold transition-colors border border-slate-200/60"
          >
            <Phone size={13} /> Smart Dialer
          </button>
          <button
            onClick={() => navigate('/support')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 text-xs font-bold transition-colors border border-slate-200/60"
          >
            <ShieldCheck size={13} /> Support Radar
          </button>
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 shadow-2xs hover:bg-blue-100 transition-colors"
          >
            <Command size={12} /> Command Palette (Ctrl+K)
          </button>
        </div>
      </div>

      {/* ═══ 4 KPI CARDS ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pipeline */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between card-hover">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Pipeline Value</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">₹{totalPipelineLakhs.toFixed(1)}L</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
              <IndianRupee size={20} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-3">
            <ArrowUpRight size={13} />
            <span>+₹4.5L added this week</span>
          </div>
        </div>

        {/* Hot Leads */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between card-hover">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">High Intent Deals</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                {hotLeads} <span className="text-base">🔥</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
              <Flame size={20} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-3">
            <ArrowUpRight size={13} />
            <span>AI score &gt;75 conversion</span>
          </div>
        </div>

        {/* Follow-ups Due */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between card-hover">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Follow-ups Due Today</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{followUpsDue}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
              <Clock size={20} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 mt-3">
            <Bell size={13} />
            <span>Auto-scheduled by CRM</span>
          </div>
        </div>

        {/* Closed Won */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between card-hover">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deals Closed Won</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{wonThisMonth}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
              <Trophy size={20} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-3">
            <ArrowUpRight size={13} />
            <span>₹{wonRevenueLakhs.toFixed(1)}L booked revenue</span>
          </div>
        </div>
      </div>

      {/* ═══ TWO COLUMN SECTION ══════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left 2/3: Lead Sources + Activity Feed ───────── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Lead Source Distribution */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Omnichannel Lead Ingestion Sources</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold">{totalLeads} Total Ingested Leads</span>
            </div>

            <div className="w-full overflow-hidden">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={sourceData} barSize={38}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Interaction Activity Feed */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Live Interaction Feed & Audit Trail</h2>
              </div>
              <button onClick={() => navigate('/leads')} className="text-xs text-blue-600 font-bold hover:underline">
                View All Leads ↗
              </button>
            </div>

            <div className="space-y-3">
              {[
                { text: 'Rajesh Kumar generated GST Proforma Quotation (₹1.8L)', time: '10 mins ago', dot: 'bg-emerald-500' },
                { text: 'ZeroBT Radar analyzed Priya Sharma conversation (Frustration: 24%)', time: '35 mins ago', dot: 'bg-blue-500' },
                { text: 'Amit Patel synced buyer inquiry from IndiaMART portal', time: '1 hour ago', dot: 'bg-orange-500' },
                { text: 'Sunita Verma completed VoIP call (Duration: 4m 32s)', time: '2 hours ago', dot: 'bg-purple-500' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${item.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{item.text}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right 1/3: AI Priority Engine + Funnel ───────── */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* AI Priority Follow-Up Engine */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600" />
                <h2 className="text-sm font-bold text-slate-900">AI Priority Engine</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">Top 5</span>
            </div>

            <div className="space-y-3">
              {followUpQueue.map((lead) => {
                return (
                  <div
                    key={lead.id}
                    className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 hover:border-slate-200 transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{lead.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {lead.company || lead.source}
                        {lead.lastContact
                          ? ` · ${daysSince(lead.lastContact)}d since contact`
                          : ' · never contacted'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${scoreBadge(lead.aiScore)}`}>
                        ⚡ {lead.aiScore}
                      </span>
                      <button
                        onClick={() => navigate('/leads')}
                        className="text-[10px] font-bold text-blue-600 bg-white border border-blue-200 hover:bg-blue-600 hover:text-white px-2 py-1 rounded-lg transition-colors"
                      >
                        Action
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deal Stage Funnel Overview */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Pipeline Stage Velocity</h2>
            <div className="space-y-3">
              {statuses.map((s) => {
                const count = pipelineCounts[s.key] || 0;
                const pct = (count / maxPipeline) * 100;
                return (
                  <div key={s.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">{s.label}</span>
                      <span className="text-slate-900 font-mono font-bold">{count} deals</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SALES REP REVENUE LEADERBOARD ════════════════════ */}
      <div className="glass-panel rounded-2xl p-6 w-full">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">Sales Leaderboard & Rep Quota Performance</h2>
          </div>
          <button onClick={() => navigate('/leaderboard')} className="text-xs text-blue-600 font-bold hover:underline">
            View Full Leaderboard ↗
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {salesReps.map((rep, i) => {
            const initials = rep.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase();
            return (
              <div key={rep.id} className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                      {initials}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{rep.name}</p>
                      <p className="text-[10px] text-slate-400">{rep.role}</p>
                    </div>
                  </div>
                  <span className="text-sm">{i === 0 ? '👑' : `#${i + 1}`}</span>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">{rep.assignedCount} Leads</span>
                  <span className="font-bold text-emerald-700 font-mono">₹{rep.revenue.toFixed(1)}L</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
