import { useMemo, useState } from 'react';
import {
  Users,
  Target,
  TrendingUp,
  Brain,
  Mail,
  Phone,
  Star,
  ShieldCheck,
  Building,
  CheckCircle2,
  Clock,
  Sparkles,
  MessageSquare,
  IndianRupee,
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const REP_ATTENDANCE: Record<string, { status: string; shift: string; location: string; color: string }> = {
  u1: { status: 'On Duty (Active)', shift: '10:00 AM - 7:00 PM', location: 'Mumbai HQ', color: 'bg-emerald-500' },
  u2: { status: 'Field Visit (Store #45)', shift: '09:30 AM - 6:30 PM', location: 'Delhi NCR', color: 'bg-blue-500' },
  u3: { status: 'Remote / Work From Home', shift: '10:00 AM - 7:00 PM', location: 'Bengaluru', color: 'bg-purple-500' },
  u4: { status: 'Office HQ (Desk #12)', shift: '10:00 AM - 7:00 PM', location: 'Gurgaon', color: 'bg-emerald-500' },
};

export default function Team() {
  const users = useCrmStore((s) => s.users);
  const leads = useCrmStore((s) => s.leads);
  const [roleFilter, setRoleFilter] = useState('All');

  const teamCards = useMemo(() => {
    return users
      .filter((u) => roleFilter === 'All' || u.role === roleFilter)
      .map((user) => {
        const assigned = leads.filter((lead) => lead.assignedTo === user.id || lead.assignedTo === user.name);
        const won = assigned.filter((lead) => lead.status === 'Won').length;
        const avgAi = assigned.length
          ? Math.round(assigned.reduce((sum, lead) => sum + lead.aiScore, 0) / assigned.length)
          : 0;
        const closeRate = assigned.length ? Math.round((won / assigned.length) * 100) : 0;
        const coachingTip =
          closeRate >= 35
            ? 'Top enterprise closer. Assign to high-budget (>₹10L) deals.'
            : avgAi >= 75
            ? 'High lead quality. Focus on closing proposals within 48 hours.'
            : 'Prioritize first-touch SLA response & WhatsApp quick follow-up.';

        const attendance = REP_ATTENDANCE[user.id] || {
          status: 'General Shift Active',
          shift: '10:00 AM - 7:00 PM',
          location: 'Office HQ',
          color: 'bg-emerald-500',
        };

        return {
          user,
          assigned: assigned.length,
          won,
          avgAi,
          closeRate,
          coachingTip,
          attendance,
        };
      });
  }, [leads, users, roleFilter]);

  return (
    <div className="p-6 space-y-6">
      {/* ═══ HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Enterprise Team Workspace</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
              {users.length} Team Members
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Shift attendance, rep quota tracking, AI coaching insights & performance metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Role Filter Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
            {['All', 'Sales', 'Manager', 'Admin'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  roleFilter === r ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ STATS GRID ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Staff</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{users.filter((u) => u.isActive).length} Members</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            <CheckCircle2 size={12} /> 100% Shift Attendance Today
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Team Won Deals</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{leads.filter((l) => l.status === 'Won').length} Deals</p>
          <p className="text-[11px] text-blue-600 font-semibold mt-2 flex items-center gap-1">
            <TrendingUp size={12} /> ₹24.5L Total Value
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average AI Lead Score</p>
          <p className="text-2xl font-bold text-purple-700 mt-1 font-mono">
            ⚡{' '}
            {leads.length ? Math.round(leads.reduce((sum, lead) => sum + lead.aiScore, 0) / leads.length) : 0}
            /100
          </p>
          <p className="text-[11px] text-slate-400 font-semibold mt-2">Pipeline Quality Index</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Coaching Engine</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 flex items-center gap-1">
            <Sparkles size={20} className="text-emerald-500" /> Active
          </p>
          <p className="text-[11px] text-slate-400 font-semibold mt-2">Gemini AI Guidance</p>
        </div>
      </div>

      {/* ═══ TEAM MEMBER CARDS ═══════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {teamCards.map((card) => (
          <div
            key={card.user.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md transition-all space-y-4"
          >
            {/* Header: Avatar, Name, Role & Attendance Badge */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {initials(card.user.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-gray-900">{card.user.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {card.user.role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <Building size={11} /> {card.attendance.location} • {card.attendance.shift}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                <span className={`w-2 h-2 rounded-full ${card.attendance.color} animate-pulse`} />
                {card.attendance.status}
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Leads</p>
                <p className="text-base font-bold text-slate-900 font-mono mt-0.5">{card.assigned}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Won</p>
                <p className="text-base font-bold text-emerald-700 font-mono mt-0.5">{card.won}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Win Rate</p>
                <p className="text-base font-bold text-blue-700 font-mono mt-0.5">{card.closeRate}%</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Avg Score</p>
                <p className="text-base font-bold text-purple-700 font-mono mt-0.5">⚡ {card.avgAi}</p>
              </div>
            </div>

            {/* AI Coaching Tip Box */}
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-start gap-2.5">
              <Sparkles size={16} className="text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-purple-900">AI Performance Coaching:</p>
                <p className="text-xs text-purple-800 mt-0.5 leading-relaxed">{card.coachingTip}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
