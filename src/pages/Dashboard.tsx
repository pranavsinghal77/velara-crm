import { useMemo, useState } from 'react';
import {
  Users,
  Flame,
  Bell,
  Trophy,
  Sparkles,
  BarChart3,
  Activity,
  ArrowUpRight,
  ChevronRight,
  Bot,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { getLeads, getReminders, getUsers, getCurrentUser } from '../types/index';
import type { Lead } from '../types/index';

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function AIBriefing() {
  const key = `velara_briefing_dismissed_${todayKey()}`;
  const [visible, setVisible] = useState(
    () => localStorage.getItem(key) !== '1',
  );
  const user = getCurrentUser();

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(key, '1');
    setVisible(false);
  };

  return (
    <div className="relative w-full rounded-xl p-4 bg-gradient-to-r from-violet-600 to-blue-600 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Bot size={24} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-base">
            {getGreeting()}, {user?.name ?? 'there'}! 🌟
          </p>
          <p className="text-violet-200 text-sm">Here's your AI briefing for today</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {(['🔥 3 HOT leads need attention', '⏰ 2 follow-ups due today', '💰 ₹24L pipeline at risk'] as const).map((chip) => (
          <span key={chip} className="text-xs text-white bg-white/20 px-3 py-1 rounded-full whitespace-nowrap">
            {chip}
          </span>
        ))}
      </div>
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function scoreBadge(score: number) {
  if (score >= 80) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

const ACTIVITY_ITEMS = [
  { text: 'New lead Rajesh Kumar added from JustDial', time: '2 mins ago', dot: 'bg-green-500' },
  { text: 'AI scored Priya Sharma: 85/100 HOT', time: '15 mins ago', dot: 'bg-blue-500' },
  { text: 'Follow-up sent to Amit Patel via WhatsApp', time: '1 hour ago', dot: 'bg-teal-500' },
  { text: 'Arjun Mehta deal WON — ₹6L', time: '2 hours ago', dot: 'bg-yellow-500' },
  { text: 'Reminder set for Sunita Verma', time: '3 hours ago', dot: 'bg-amber-500' },
  { text: 'New lead Rohit Gupta from Website', time: '5 hours ago', dot: 'bg-green-500' },
];

const INSIGHT_CHIPS = [
  '🔥 Rajesh Kumar ready to close',
  '⏰ Call Priya Sharma today',
  '💡 3 leads need follow-up',
];

// ─── component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const leads = useMemo(() => getLeads(), []);
  const reminders = useMemo(() => getReminders(), []);
  const users = useMemo(() => getUsers(), []);

  // KPI counts
  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => l.isHot).length;
  const followUpsDue = reminders.filter((r) => r.isToday && !r.isCompleted).length;
  const wonThisMonth = leads.filter((l) => l.status === 'Won').length;

  // Source chart data
  const sourceData = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      map[l.source] = (map[l.source] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [leads]);

  // Follow-up queue – top 5 active leads by AI score
  const followUpQueue = useMemo(
    () =>
      [...leads]
        .filter((l) => l.status !== 'Won' && l.status !== 'Lost')
        .sort((a, b) => b.aiScore - a.aiScore)
        .slice(0, 5),
    [leads],
  );

  // Pipeline counts
  const statuses: { label: string; key: Lead['status']; color: string }[] = [
    { label: 'New', key: 'New', color: 'bg-blue-500' },
    { label: 'Contacted', key: 'Contacted', color: 'bg-indigo-500' },
    { label: 'Qualified', key: 'Qualified', color: 'bg-green-500' },
    { label: 'Negotiation', key: 'Negotiation', color: 'bg-amber-500' },
    { label: 'Won', key: 'Won', color: 'bg-emerald-500' },
    { label: 'Lost', key: 'Lost', color: 'bg-red-500' },
  ];
  const pipelineCounts = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      map[l.status] = (map[l.status] || 0) + 1;
    });
    return map;
  }, [leads]);
  const maxPipeline = Math.max(...Object.values(pipelineCounts), 1);

  // Leaderboard – sales reps
  const salesReps = useMemo(() => {
    const reps = users.filter((u) => u.role === 'Sales');
    return reps
      .map((u) => ({
        ...u,
        assignedCount: leads.filter((l) => l.assignedTo === u.name).length,
      }))
      .sort((a, b) => b.assignedCount - a.assignedCount);
  }, [users, leads]);
  const maxAssigned = Math.max(...salesReps.map((r) => r.assignedCount), 1);

  // Activity feed
  const activityItems = ACTIVITY_ITEMS;

  // Insight chips
  const insightChips = INSIGHT_CHIPS;

  return (
    <div className="space-y-6">
      <AIBriefing />
      {/* ═══ KPI Cards ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{totalLeads}</p>
              <p className="text-sm text-gray-500 mt-1">Total Leads</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users size={20} className="text-[#2563EB]" />
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-green-600">
            <ArrowUpRight size={14} />
            <span>12% vs last month</span>
          </div>
        </div>

        {/* Hot Leads */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {hotLeads} <span className="text-lg">🔥</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">Hot Leads</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Flame size={20} className="text-[#EF4444]" />
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-green-600">
            <ArrowUpRight size={14} />
            <span>8% vs last month</span>
          </div>
        </div>

        {/* Follow-ups Due */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{followUpsDue}</p>
              <p className="text-sm text-gray-500 mt-1">Follow-ups Due Today</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Bell size={20} className="text-[#F59E0B]" />
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-green-600">
            <ArrowUpRight size={14} />
            <span>5% vs last month</span>
          </div>
        </div>

        {/* Won */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{wonThisMonth}</p>
              <p className="text-sm text-gray-500 mt-1">Won This Month</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Trophy size={20} className="text-[#10B981]" />
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-green-600">
            <ArrowUpRight size={14} />
            <span>20% vs last month</span>
          </div>
        </div>
      </div>

      {/* ═══ AI Insights Banner ══════════════════════════════ */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sparkles size={22} className="text-white shrink-0" />
          <span className="text-white font-medium text-sm">
            Velara AI has insights for you today
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {insightChips.map((chip) => (
            <span
              key={chip}
              className="text-xs text-white bg-white/20 px-3 py-1 rounded-full"
            >
              {chip}
            </span>
          ))}
          <button className="text-xs text-white border border-white/50 px-3 py-1 rounded-full hover:bg-white/10 transition-colors flex items-center gap-1">
            View All <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ═══ Two Column Section ══════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left 2/3 ──────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Lead Source Chart */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-gray-600" />
              <h2 className="text-base font-semibold text-gray-900">
                Lead Source Distribution
              </h2>
            </div>
            <div className="w-full overflow-hidden">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sourceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} className="text-gray-600" />
              <h2 className="text-base font-semibold text-gray-900">
                Recent Activity
              </h2>
            </div>
            <div>
              {activityItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${item.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{item.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right 1/3 ─────────────────────────────────────── */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* AI Follow-up Queue */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-[#7C3AED]" />
              <h2 className="text-base font-semibold text-gray-900">
                AI Follow-up Engine
              </h2>
            </div>
            <div className="space-y-3">
              {followUpQueue.map((lead) => {
                const days = daysSince(lead.lastContact);
                return (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {lead.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {lead.company ?? 'No company'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scoreBadge(lead.aiScore)}`}
                      >
                        {lead.aiScore}
                      </span>
                      <span className="text-[10px] text-gray-400 w-14 text-right">
                        {days === 0 ? 'Today' : `${days}d ago`}
                      </span>
                      <button className="text-[11px] font-medium text-[#2563EB] border border-[#2563EB] rounded-lg px-2 py-0.5 hover:bg-blue-50 transition-colors">
                        Follow Up
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-3 text-center">
              AI auto-schedules follow-ups based on score
            </p>
          </div>

          {/* Pipeline Overview */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Pipeline Overview
            </h2>
            <div className="space-y-2">
              {statuses.map((s) => {
                const count = pipelineCounts[s.key] || 0;
                const pct = (count / maxPipeline) * 100;
                return (
                  <div key={s.key} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-gray-600 w-24 flex-shrink-0">{s.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${s.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Sales Leaderboard ═══════════════════════════════ */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 w-full">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={18} className="text-amber-500" />
          <h2 className="text-base font-semibold text-gray-900">
            Sales Leaderboard
          </h2>
        </div>
        <div className="space-y-4">
          {salesReps.map((rep, i) => {
            const pct = (rep.assignedCount / maxAssigned) * 100;
            const initials = rep.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase();
            return (
              <div key={rep.id} className="flex items-center gap-4">
                <span className="text-lg font-bold text-gray-300 w-6 text-center">
                  {i === 0 ? '👑' : i + 1}
                </span>
                <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {rep.name}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">{rep.role}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      {rep.assignedCount} leads
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#2563EB]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
