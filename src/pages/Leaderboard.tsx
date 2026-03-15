import { useState, useMemo } from 'react';
import {
  Trophy,
  TrendingUp,
  Target,
  Zap,
  Star,
  Users,
  Phone,
  Medal,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import { getLeads, getUsers } from '../types/index';

// ─── types ────────────────────────────────────────────────────────────────────

type Period = 'This Week' | 'This Month' | 'This Quarter';

interface RepStats {
  id: string;
  name: string;
  role: string;
  leads: number;
  won: number;
  revenue: number;
  avgScore: number;
  calls: number;
  streak: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtRevenue(v: number) {
  return v >= 100 ? `₹${(v / 100).toFixed(1)} Cr` : `₹${v.toFixed(1)}L`;
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const MOCK_CALLS: Record<string, number> = { u1: 24, u2: 18, u3: 31, u4: 14 };
const MOCK_STREAK: Record<string, number> = { u1: 3, u2: 5, u3: 7, u4: 2 };
const MOCK_REVENUE: Record<string, number> = { u1: 18.5, u2: 12.3, u3: 22.1, u4: 8.7 };

function fallbackRevenue(id: string) {
  const seed = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return 6 + (seed % 17);
}

const WEEKLY_DATA = [
  { day: 'Mon', Pranav: 2, Rahul: 1, Sneha: 3, Karan: 1 },
  { day: 'Tue', Pranav: 3, Rahul: 2, Sneha: 4, Karan: 2 },
  { day: 'Wed', Pranav: 1, Rahul: 3, Sneha: 2, Karan: 1 },
  { day: 'Thu', Pranav: 4, Rahul: 2, Sneha: 5, Karan: 3 },
  { day: 'Fri', Pranav: 2, Rahul: 1, Sneha: 3, Karan: 1 },
  { day: 'Sat', Pranav: 1, Rahul: 0, Sneha: 2, Karan: 0 },
];

const COLORS = ['#2563EB', '#F59E0B', '#10B981', '#8B5CF6'];

// ─── component ────────────────────────────────────────────────────────────────

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>('This Month');
  const users = useMemo(() => getUsers(), []);
  const leads = useMemo(() => getLeads(), []);

  // Build rep stats from real data
  const reps: RepStats[] = useMemo(() => {
    return users
      .filter((u) => u.isActive)
      .map((u) => {
        const userLeads = leads.filter((l) => l.assignedTo === u.id);
        const won = userLeads.filter((l) => l.status === 'Won');
        const avgScore = userLeads.length ? Math.round(userLeads.reduce((s, l) => s + l.aiScore, 0) / userLeads.length) : 0;
        return {
          id: u.id,
          name: u.name,
          role: u.role,
          leads: userLeads.length,
          won: won.length,
          revenue: MOCK_REVENUE[u.id] ?? fallbackRevenue(u.id),
          avgScore,
          calls: MOCK_CALLS[u.id] ?? 10,
          streak: MOCK_STREAK[u.id] ?? 1,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [users, leads]);

  const top3 = reps.slice(0, 3);
  const rest = reps.slice(3);

  // Radar data for top performer
  const topRep = top3[0];
  const radarData = topRep ? [
    { metric: 'Revenue',   value: Math.min(100, Math.round((topRep.revenue / 25) * 100)) },
    { metric: 'Deals',     value: Math.min(100, topRep.won * 12) },
    { metric: 'Calls',     value: Math.min(100, topRep.calls * 3) },
    { metric: 'Avg Score', value: topRep.avgScore },
    { metric: 'Streak',    value: Math.min(100, topRep.streak * 14) },
  ] : [];

  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  const podiumConfig = [
    { place: '2nd', medal: '🥈', borderColor: 'border-gray-400', avatarSize: 'w-12 h-12', podiumH: 'h-24', bg: 'from-gray-100 to-gray-200', badgeCls: 'bg-gray-200 text-gray-700', textColor: 'text-gray-600' },
    { place: '1st', medal: '👑', borderColor: 'border-yellow-400', avatarSize: 'w-16 h-16', podiumH: 'h-32', bg: 'from-yellow-50 to-amber-100', badgeCls: 'bg-amber-400 text-white', textColor: 'text-amber-600' },
    { place: '3rd', medal: '🥉', borderColor: 'border-orange-400', avatarSize: 'w-11 h-11', podiumH: 'h-20', bg: 'from-orange-50 to-orange-100', badgeCls: 'bg-orange-400 text-white', textColor: 'text-orange-600' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* ═══ HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy size={24} className="text-amber-500 fill-amber-400" />
            <h1 className="text-2xl font-bold text-gray-900">Sales Leaderboard</h1>
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Live competition board — Q1 2026</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['This Week', 'This Month', 'This Quarter'] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${period === p ? 'bg-[#2563EB] text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ PODIUM ══════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-sm font-bold text-gray-700 text-center mb-6 uppercase tracking-widest">🏆 Top Performers</h2>
        <div className="flex items-end justify-center gap-6">
          {podiumOrder.map((rep, idx) => {
            if (!rep) return null;
            const cfg = podiumConfig[idx];
            return (
              <div key={rep.id} className="flex flex-col items-center gap-2">
                {/* crown / medal */}
                <span className="text-2xl">{cfg.medal}</span>
                {/* avatar */}
                <div className={`${cfg.avatarSize} rounded-full border-4 ${cfg.borderColor} bg-[#2563EB] flex items-center justify-center text-white font-bold`}>
                  {initials(rep.name)}
                </div>
                {/* name */}
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900">{rep.name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badgeCls}`}>{cfg.place} Place</span>
                </div>
                {/* stats */}
                <div className="text-center">
                  <p className={`text-lg font-bold ${cfg.textColor}`}>{fmtRevenue(rep.revenue)}</p>
                  <p className="text-[11px] text-gray-500">{rep.won} Deals Won</p>
                </div>
                {/* podium base */}
                <div className={`w-28 ${cfg.podiumH} rounded-t-xl bg-gradient-to-b ${cfg.bg} border border-gray-200 flex items-center justify-center`}>
                  <p className={`text-2xl font-black ${cfg.textColor}`}>{cfg.place.charAt(0)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ INCENTIVE CARDS ═════════════════════════════════ */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { emoji: '🏆', title: 'Top Performer Bonus', prize: '₹25,000', leader: reps[0]?.name ?? 'TBD', color: 'border-amber-200 bg-amber-50', badgeColor: 'bg-amber-100 text-amber-700' },
          { emoji: '⭐', title: 'Most Deals',          prize: '₹10,000', leader: [...reps].sort((a,b)=>b.won-a.won)[0]?.name ?? 'TBD', color: 'border-blue-200 bg-blue-50', badgeColor: 'bg-blue-100 text-blue-700' },
          { emoji: '🚀', title: 'Fastest Closer',      prize: '₹5,000',  leader: [...reps].sort((a,b)=>b.calls-a.calls)[0]?.name ?? 'TBD', color: 'border-green-200 bg-green-50', badgeColor: 'bg-green-100 text-green-700' },
          { emoji: '📈', title: 'Most Improved',       prize: '₹5,000',  leader: [...reps].sort((a,b)=>b.streak-a.streak)[0]?.name ?? 'TBD', color: 'border-purple-200 bg-purple-50', badgeColor: 'bg-purple-100 text-purple-700' },
        ]).map((c) => (
          <div key={c.title} className={`rounded-xl border p-4 ${c.color}`}>
            <p className="text-2xl mb-1">{c.emoji}</p>
            <p className="text-sm font-bold text-gray-900">{c.title}</p>
            <p className="text-lg font-black text-gray-800 mt-1">{c.prize}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                {initials(c.leader)}
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.badgeColor}`}>{c.leader} leading</span>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ MAIN TABLE + CHARTS ═════════════════════════════ */}
      <div className="flex gap-5">
        {/* Full rankings table */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">Full Rankings</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium text-left w-8">#</th>
                <th className="pb-2 font-medium text-left">Rep</th>
                <th className="pb-2 font-medium text-center">Leads</th>
                <th className="pb-2 font-medium text-center">Won</th>
                <th className="pb-2 font-medium text-center">Revenue</th>
                <th className="pb-2 font-medium text-center">Avg Score</th>
                <th className="pb-2 font-medium text-center">Calls</th>
                <th className="pb-2 font-medium text-center">🔥 Streak</th>
                <th className="pb-2 font-medium text-left pl-3">Performance</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((rep, i) => {
                const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                const maxRev = reps[0]?.revenue || 1;
                return (
                  <tr key={rep.id} className={`border-b border-gray-50 ${i < 3 ? 'bg-amber-50/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="py-3 text-center font-bold text-base">{rankEmoji}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`} style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                          {initials(rep.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{rep.name}</p>
                          <p className="text-[10px] text-gray-400">{rep.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center text-gray-600">{rep.leads}</td>
                    <td className="py-3 text-center font-semibold text-gray-900">{rep.won}</td>
                    <td className="py-3 text-center font-bold text-green-600">{fmtRevenue(rep.revenue)}</td>
                    <td className="py-3 text-center text-gray-600">{rep.avgScore}</td>
                    <td className="py-3 text-center text-gray-600">{rep.calls}</td>
                    <td className="py-3 text-center">
                      <span className="font-bold text-orange-500">{rep.streak} 🔥</span>
                    </td>
                    <td className="py-3 pl-3 w-32">
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(rep.revenue / maxRev) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* rest (if any beyond reps already shown) */}
              {rest.map((rep, i) => {
                const idx = i + top3.length;
                const maxRev = reps[0]?.revenue || 1;
                return (
                  <tr key={rep.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 text-center text-gray-500 font-semibold">{idx + 1}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {initials(rep.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{rep.name}</p>
                          <p className="text-[10px] text-gray-400">{rep.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center text-gray-600">{rep.leads}</td>
                    <td className="py-3 text-center font-semibold text-gray-900">{rep.won}</td>
                    <td className="py-3 text-center font-bold text-green-600">{fmtRevenue(rep.revenue)}</td>
                    <td className="py-3 text-center text-gray-600">{rep.avgScore}</td>
                    <td className="py-3 text-center text-gray-600">{rep.calls}</td>
                    <td className="py-3 text-center"><span className="font-bold text-orange-500">{rep.streak} 🔥</span></td>
                    <td className="py-3 pl-3 w-32">
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400 rounded-full" style={{ width: `${(rep.revenue / maxRev) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right: charts */}
        <div className="w-[300px] shrink-0 space-y-4">
          {/* Weekly activity chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-blue-600" />
              <h4 className="text-xs font-bold text-gray-900">Daily Deals This Week</h4>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={WEEKLY_DATA} barSize={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} width={20} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                {users.slice(0, 4).map((u, i) => (
                  <Bar key={u.id} dataKey={u.name.split(' ')[0]} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar for top performer */}
          {topRep && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Star size={14} className="text-amber-500 fill-amber-400" />
                <h4 className="text-xs font-bold text-gray-900">Top Performer Radar</h4>
              </div>
              <p className="text-[10px] text-gray-400 mb-2">{topRep.name}</p>
              <ResponsiveContainer width="100%" height={160}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                  <Radar dataKey="value" stroke="#2563EB" fill="#2563EB" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Quick stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h4 className="text-xs font-bold text-gray-900">Team Summary</h4>
            {([
              { icon: Target,  label: 'Total Deals Won',   value: reps.reduce((s, r) => s + r.won, 0),              color: 'text-green-600 bg-green-50' },
              { icon: Phone,   label: 'Total Calls Made',  value: reps.reduce((s, r) => s + r.calls, 0),            color: 'text-blue-600 bg-blue-50' },
              { icon: Medal,   label: 'Avg Win Rate',      value: `${Math.round(reps.reduce((s, r) => s + (r.leads ? r.won / r.leads * 100 : 0), 0) / (reps.length || 1))}%`, color: 'text-purple-600 bg-purple-50' },
              { icon: Zap,     label: 'Top Streak',        value: `${Math.max(...reps.map((r) => r.streak))} 🔥`,   color: 'text-amber-600 bg-amber-50' },
            ] as const).map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}><Icon size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                    <p className="text-sm font-bold text-gray-900">{s.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
