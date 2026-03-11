import { useState, useMemo } from 'react';
import {
  IndianRupee,
  TrendingUp,
  Target,
  Clock,
  Filter,
  BarChart3,
  Sparkles,
  Users,
  Star,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { getLeads } from '../types/index';
import type { Lead } from '../types/index';

// ─── constants ────────────────────────────────────────────────────────────────

type Range = '7 Days' | '30 Days' | '90 Days';

const SOURCE_COLORS: Record<string, string> = {
  JustDial: '#2563EB', IndiaMART: '#F97316', Website: '#10B981', WhatsApp: '#14B8A6', Referral: '#8B5CF6',
};

const FUNNEL_STAGES = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won'] as const;
const FUNNEL_COLORS = ['#2563EB', '#6366F1', '#8B5CF6', '#F59E0B', '#10B981'];

const WEEK_DATA = [
  { week: 'Week 1', newLeads: 4, converted: 1 },
  { week: 'Week 2', newLeads: 7, converted: 2 },
  { week: 'Week 3', newLeads: 5, converted: 2 },
  { week: 'Week 4', newLeads: 9, converted: 4 },
  { week: 'Week 5', newLeads: 6, converted: 2 },
  { week: 'Week 6', newLeads: 11, converted: 5 },
  { week: 'Week 7', newLeads: 8, converted: 3 },
];

const AI_INSIGHTS = [
  { emoji: '🎯', text: 'Best converting source: Referral (avg score 89)', conf: 92 },
  { emoji: '⏰', text: 'Optimal follow-up time: Tuesday-Thursday 10-11 AM', conf: 87 },
  { emoji: '🔥', text: '5 HOT leads need immediate attention', conf: 95 },
  { emoji: '📈', text: 'Conversion rate up 12% vs last month', conf: 78 },
  { emoji: '💡', text: 'IndiaMART leads convert 40% faster than average', conf: 83 },
];

function parseBudget(b?: string): number {
  if (!b) return 0;
  const n = parseFloat(b.replace(/[^0-9.]/g, ''));
  if (b.toLowerCase().includes('cr')) return n * 100;
  if (b.toLowerCase().includes('l')) return n;
  return n;
}

function fmt(v: number) {
  return v >= 100 ? `₹${(v / 100).toFixed(1)} Cr` : `₹${v.toFixed(1)} L`;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [range, setRange] = useState<Range>('30 Days');
  const leads = useMemo<Lead[]>(() => getLeads(), []);

  // ── KPIs ──────────────────────────────────────────────────
  const totalPipeline = useMemo(() => leads.reduce((s, l) => s + parseBudget(l.budget), 0), [leads]);
  const wonLeads = leads.filter((l) => l.status === 'Won');
  const convRate = leads.length ? ((wonLeads.length / leads.length) * 100) : 0;
  const avgDeal = wonLeads.length ? wonLeads.reduce((s, l) => s + parseBudget(l.budget), 0) / wonLeads.length : 0;

  // ── source pie ────────────────────────────────────────────
  const sourceData = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach((l) => m.set(l.source, (m.get(l.source) || 0) + 1));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [leads]);
  const sourceTotal = sourceData.reduce((s, d) => s + d.value, 0);

  // ── funnel ────────────────────────────────────────────────
  const funnelData = useMemo(() => {
    const counts = FUNNEL_STAGES.map((st) => leads.filter((l) => l.status === st).length);
    // cumulative: each stage includes all later stages too
    const cumulative = FUNNEL_STAGES.map((_, i) => counts.slice(i).reduce((a, b) => a + b, 0));
    return FUNNEL_STAGES.map((stage, i) => ({
      stage,
      count: cumulative[i],
      pct: i === 0 ? 100 : cumulative[i - 1] ? Math.round((cumulative[i] / cumulative[i - 1]) * 100) : 0,
      drop: i === 0 ? 0 : cumulative[i - 1] ? Math.round(((cumulative[i - 1] - cumulative[i]) / cumulative[i - 1]) * 100) : 0,
    }));
  }, [leads]);
  const maxFunnel = funnelData[0]?.count || 1;

  // ── source performance table ──────────────────────────────
  const sourcePerfData = useMemo(() => {
    const m = new Map<string, { total: number; won: number; scoreSum: number }>();
    leads.forEach((l) => {
      const e = m.get(l.source) || { total: 0, won: 0, scoreSum: 0 };
      e.total++;
      if (l.status === 'Won') e.won++;
      e.scoreSum += l.aiScore;
      m.set(l.source, e);
    });
    return Array.from(m.entries())
      .map(([source, d]) => ({ source, leads: d.total, won: d.won, rate: d.total ? (d.won / d.total) * 100 : 0, avgScore: d.total ? Math.round(d.scoreSum / d.total) : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [leads]);

  // ── team performance ──────────────────────────────────────
  const teamData = useMemo(() => {
    const m = new Map<string, { assigned: number; contacted: number; qualified: number; won: number; scoreSum: number }>();
    leads.forEach((l) => {
      const key = l.assignedTo || 'Unassigned';
      const e = m.get(key) || { assigned: 0, contacted: 0, qualified: 0, won: 0, scoreSum: 0 };
      e.assigned++;
      if (['Contacted', 'Qualified', 'Negotiation', 'Won'].includes(l.status)) e.contacted++;
      if (['Qualified', 'Negotiation', 'Won'].includes(l.status)) e.qualified++;
      if (l.status === 'Won') e.won++;
      e.scoreSum += l.aiScore;
      m.set(key, e);
    });
    return Array.from(m.entries())
      .map(([name, d]) => ({ name, ...d, avgScore: d.assigned ? Math.round(d.scoreSum / d.assigned) : 0, rate: d.assigned ? (d.won / d.assigned) * 100 : 0 }))
      .sort((a, b) => b.won - a.won);
  }, [leads]);

  // ── render ────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      {/* ═══ HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Insights</h1>
          <p className="text-sm text-gray-500">AI-powered performance overview</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['7 Days', '30 Days', '90 Days'] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${range === r ? 'bg-[#2563EB] text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ ROW 1 — KPI CARDS ═══════════════════════════════ */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { label: 'Total Revenue Pipeline', value: fmt(totalPipeline), icon: IndianRupee, color: 'text-green-600 bg-green-50', sub: `${leads.length} active leads` },
          { label: 'Conversion Rate', value: `${convRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-blue-600 bg-blue-50', sub: `${wonLeads.length} won of ${leads.length}` },
          { label: 'Avg Deal Size', value: fmt(avgDeal), icon: Target, color: 'text-purple-600 bg-purple-50', sub: `across ${wonLeads.length} deals` },
          { label: 'Lead Response Time', value: '2.4 hrs', icon: Clock, color: 'text-amber-600 bg-amber-50', sub: 'avg first response' },
        ] as const).map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">{c.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.color}`}><Icon size={16} /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ═══ AI REVENUE FORECASTER ═══════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-purple-600 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#7C3AED]" />
            <h3 className="text-sm font-bold text-gray-900">AI Revenue Forecast</h3>
            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">Next 30 Days</span>
          </div>
          <span className="text-[11px] font-semibold text-[#7C3AED]">Powered by Velara AI</span>
        </div>

        {/* Content */}
        <div className="flex gap-6">
          {/* Section 1 — Forecast Numbers */}
          <div className="flex-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Projected Revenue</p>
            <p className="text-3xl font-bold text-gray-900">₹42.5L</p>
            <p className="text-xs text-green-600 font-semibold mt-0.5">↑ 18% vs last month</p>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500">AI Confidence</span>
                <span className="text-[11px] font-semibold text-[#7C3AED]">87%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#7C3AED] rounded-full" style={{ width: '87%' }} />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-gray-100 shrink-0" />

          {/* Section 2 — Deals Expected */}
          <div className="flex-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Expected Deals to Close</p>
            <p className="text-3xl font-bold text-gray-900">8 deals</p>
            <div className="mt-3 space-y-1.5">
              {([
                '🔥 3 HOT leads — very likely',
                '📈 3 Qualified — likely',
                '👀 2 Contacted — possible',
              ] as const).map((item) => (
                <p key={item} className="text-xs text-gray-600">{item}</p>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-gray-100 shrink-0" />

          {/* Section 3 — Risk Alerts */}
          <div className="flex-1">
            <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wide mb-2">⚠️ Pipeline Risks</p>
            <div className="space-y-1.5">
              {([
                'Rajesh Kumar — no contact 5 days',
                '₹8L deal at risk of going cold',
                'Competitor mentioned in 2 calls',
              ] as const).map((risk) => (
                <div key={risk} className="bg-amber-50 rounded p-2">
                  <p className="text-xs text-amber-800">{risk}</p>
                </div>
              ))}
            </div>
            <button className="mt-2 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors">
              View All Risks →
            </button>
          </div>
        </div>
      </div>

      {/* ═══ ROW 2 — LINE + PIE ══════════════════════════════ */}
      <div className="flex gap-4">
        {/* Line Chart */}
        <div className="w-[60%] bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">Lead Acquisition Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={WEEK_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="newLeads" name="New Leads" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="converted" name="Converted" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="w-[40%] bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900">Lead Sources</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={sourceData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                {sourceData.map((d) => <Cell key={d.name} fill={SOURCE_COLORS[d.name] || '#94A3B8'} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
            {sourceData.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[d.name] }} />
                {d.name} ({d.value}) {sourceTotal ? `${Math.round((d.value / sourceTotal) * 100)}%` : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ ROW 3 — FUNNEL ══════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Filter size={16} className="text-indigo-600" />
          <h3 className="text-sm font-bold text-gray-900">Sales Pipeline Funnel</h3>
        </div>
        <div className="space-y-3">
          {funnelData.map((f, i) => (
            <div key={f.stage} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-600 w-24 shrink-0 text-right">{f.stage}</span>
              <div className="flex-1 relative h-9">
                <div
                  className="h-full rounded-lg flex items-center px-3 transition-all"
                  style={{ width: `${Math.max((f.count / maxFunnel) * 100, 8)}%`, backgroundColor: FUNNEL_COLORS[i] }}
                >
                  <span className="text-xs font-bold text-white">{f.count}</span>
                </div>
              </div>
              <div className="w-20 shrink-0 text-right">
                {i > 0 ? (
                  <div>
                    <span className="text-[10px] font-semibold text-green-600">{f.pct}%</span>
                    {f.drop > 0 && <span className="text-[10px] font-semibold text-red-500 ml-1">-{f.drop}%</span>}
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-400">100%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ ROW 4 — SOURCE PERF + AI INSIGHTS ═══════════════ */}
      <div className="flex gap-4">
        {/* Source Performance */}
        <div className="w-1/2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">Source Performance</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 border-b border-gray-100">
                <th className="pb-2 text-left font-medium">Source</th>
                <th className="pb-2 text-center font-medium">Leads</th>
                <th className="pb-2 text-center font-medium">Won</th>
                <th className="pb-2 text-center font-medium">Conv Rate</th>
                <th className="pb-2 text-center font-medium">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {sourcePerfData.map((s, i) => (
                <tr key={s.source} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-gray-800 flex items-center gap-1.5">
                    {i === 0 && <Star size={12} className="text-amber-500 fill-amber-500" />}
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[s.source] }} />
                    {s.source}
                  </td>
                  <td className="py-2 text-center text-gray-600">{s.leads}</td>
                  <td className="py-2 text-center text-gray-600">{s.won}</td>
                  <td className="py-2 text-center font-semibold text-gray-800">{s.rate.toFixed(1)}%</td>
                  <td className="py-2 text-center text-gray-600">{s.avgScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI Insights */}
        <div className="w-1/2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-[#7C3AED]" />
            <h3 className="text-sm font-bold text-gray-900">AI Insights</h3>
          </div>
          <div className="space-y-2">
            {AI_INSIGHTS.map((ins) => (
              <div key={ins.text} className="bg-purple-50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0">{ins.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700">{ins.text}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-purple-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#7C3AED] rounded-full" style={{ width: `${ins.conf}%` }} />
                      </div>
                      <span className="text-[10px] font-semibold text-purple-600">{ins.conf}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM — TEAM PERFORMANCE ═══════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-gray-900">Team Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 border-b border-gray-100">
                <th className="pb-2 text-left font-medium">Rep</th>
                <th className="pb-2 text-center font-medium">Assigned</th>
                <th className="pb-2 text-center font-medium">Contacted</th>
                <th className="pb-2 text-center font-medium">Qualified</th>
                <th className="pb-2 text-center font-medium">Won</th>
                <th className="pb-2 text-center font-medium">Conv Rate</th>
                <th className="pb-2 text-center font-medium">Avg Score</th>
                <th className="pb-2 text-left font-medium pl-3">Performance</th>
              </tr>
            </thead>
            <tbody>
              {teamData.map((t, i) => (
                <tr key={t.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {t.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <span className="font-medium text-gray-800">{t.name}</span>
                      {i === 0 && <span title="Top performer">👑</span>}
                    </div>
                  </td>
                  <td className="py-3 text-center text-gray-600">{t.assigned}</td>
                  <td className="py-3 text-center text-gray-600">{t.contacted}</td>
                  <td className="py-3 text-center text-gray-600">{t.qualified}</td>
                  <td className="py-3 text-center font-semibold text-gray-800">{t.won}</td>
                  <td className="py-3 text-center font-semibold text-gray-800">{t.rate.toFixed(1)}%</td>
                  <td className="py-3 text-center text-gray-600">{t.avgScore}</td>
                  <td className="py-3 pl-3 w-36">
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(t.rate, 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
