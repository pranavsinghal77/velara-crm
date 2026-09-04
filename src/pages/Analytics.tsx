import { useEffect, useMemo, useState } from 'react';
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
import { ApiError, api } from '../lib/api';
import { leadValueLakhs, sumLeadValueLakhs } from '../lib/money';
import { useCrmStore } from '../store/useCrmStore';

// ─── constants ────────────────────────────────────────────────────────────────

type Range = '7 Days' | '30 Days' | '90 Days';

interface TrendPoint {
  week: string;
  startDate: string;
  newLeads: number;
  converted: number;
}

const SOURCE_COLORS: Record<string, string> = {
  JustDial: '#2563EB', IndiaMART: '#F97316', Website: '#10B981', WhatsApp: '#14B8A6', Referral: '#8B5CF6',
};

const FUNNEL_STAGES = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won'] as const;
const FUNNEL_COLORS = ['#2563EB', '#6366F1', '#8B5CF6', '#F59E0B', '#10B981'];

function fmt(v: number) {
  return v >= 100 ? `₹${(v / 100).toFixed(1)} Cr` : `₹${v.toFixed(1)} L`;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [range, setRange] = useState<Range>('30 Days');
  const leads = useCrmStore((s) => s.leads);
  const reminders = useCrmStore((s) => s.reminders);

  // Weekly acquisition/conversion counts, aggregated server-side from this
  // organisation's own leads. This chart previously rendered a hardcoded
  // seven-week array that never changed.
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [trendError, setTrendError] = useState('');
  // Read the clock once, at mount. Calling Date.now() inside the memo below
  // made the render impure: results shifted on any incidental re-render.
  const [asOf] = useState(() => Date.now());

  useEffect(() => {
    let ignore = false;

    api
      .get<{ data: TrendPoint[] }>('/analytics/trend')
      .then((res) => {
        if (!ignore) setTrend(res.data);
      })
      .catch((err) => {
        if (!ignore) {
          setTrendError(
            err instanceof ApiError ? err.message : 'Could not load the acquisition trend.'
          );
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // ── KPIs ──────────────────────────────────────────────────
  const totalPipeline = useMemo(() => sumLeadValueLakhs(leads), [leads]);
  const wonLeads = leads.filter((l) => l.status === 'Won');
  const convRate = leads.length ? ((wonLeads.length / leads.length) * 100) : 0;
  const avgDeal = wonLeads.length ? sumLeadValueLakhs(wonLeads) / wonLeads.length : 0;

  // Observations computed from the pipeline in front of the user. Each one is
  // a plain aggregate, not a model output, so it is stated as a fact rather
  // than dressed up with an invented confidence score.
  const overdueCount = reminders.filter((r) => !r.isCompleted && r.isOverdue).length;

  const insights = useMemo(() => {
    if (leads.length === 0) return [] as { emoji: string; text: string }[];

    const bySource = new Map<string, { total: number; score: number }>();
    for (const lead of leads) {
      const entry = bySource.get(lead.source) ?? { total: 0, score: 0 };
      entry.total += 1;
      entry.score += lead.aiScore;
      bySource.set(lead.source, entry);
    }

    const bestSource = [...bySource.entries()]
      .filter(([, v]) => v.total >= 2)
      .map(([name, v]) => ({ name, avg: Math.round(v.score / v.total) }))
      .sort((a, b) => b.avg - a.avg)[0];

    const isOpen = (status: string) => status !== 'Won' && status !== 'Lost';
    const hot = leads.filter((l) => l.isHot && isOpen(l.status));
    const stale = leads.filter(
      (l) =>
        isOpen(l.status) &&
        (!l.lastContact || asOf - new Date(l.lastContact).getTime() > 7 * 86_400_000)
    );
    const inNegotiation = leads.filter((l) => l.status === 'Negotiation');

    const out: { emoji: string; text: string }[] = [];
    if (bestSource) {
      out.push({
        emoji: '\u{1F3AF}',
        text: `Highest-scoring source: ${bestSource.name} (average score ${bestSource.avg})`,
      });
    }
    if (hot.length > 0) {
      out.push({ emoji: '\u{1F525}', text: `${hot.length} hot lead(s) still open in the pipeline` });
    }
    if (stale.length > 0) {
      out.push({
        emoji: '\u{23F0}',
        text: `${stale.length} open lead(s) with no contact in the last 7 days`,
      });
    }
    if (inNegotiation.length > 0) {
      out.push({
        emoji: '\u{1F4C8}',
        text: `${inNegotiation.length} deal(s) in Negotiation worth ${fmt(
          sumLeadValueLakhs(inNegotiation)
        )}`,
      });
    }
    return out;
  }, [leads, asOf]);

  /**
   * Weighted pipeline forecast: each open deal contributes its value times a
   * stage probability. This replaces a panel that hardcoded "Projected revenue
   * Rs 42.5L", "+18% vs last month", "87% AI confidence", "8 deals" and three
   * invented pipeline risks - one of which happened to name a real lead, which
   * made it read as a genuine finding.
   *
   * The weights are a stated assumption, not a model output, so the panel says
   * so rather than claiming a confidence score.
   */
  const forecast = useMemo(() => {
    const STAGE_WEIGHT: Record<string, number> = {
      New: 0.1,
      Contacted: 0.2,
      Qualified: 0.4,
      Negotiation: 0.7,
    };

    const open = leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost');
    const weighted = open.reduce(
      (sum, l) => sum + leadValueLakhs(l) * (STAGE_WEIGHT[l.status] ?? 0),
      0
    );

    const byStage = open.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      weightedLakhs: weighted,
      openCount: open.length,
      byStage: Object.entries(byStage).sort(
        (a, b) => (STAGE_WEIGHT[b[0]] ?? 0) - (STAGE_WEIGHT[a[0]] ?? 0)
      ),
    };
  }, [leads]);

  /** Risks read off the actual pipeline. Empty is a valid, honest result. */
  const risks = useMemo(() => {
    const out: string[] = [];
    const open = leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost');

    const staleDays = (l: (typeof open)[number]) =>
      l.lastContact ? Math.floor((asOf - new Date(l.lastContact).getTime()) / 86_400_000) : null;

    open
      .map((l) => ({ lead: l, days: staleDays(l) }))
      .filter((x) => x.days === null || x.days >= 5)
      .sort((a, b) => leadValueLakhs(b.lead) - leadValueLakhs(a.lead))
      .slice(0, 3)
      .forEach(({ lead, days }) => {
        out.push(
          days === null
            ? `${lead.name} - never contacted (${fmt(leadValueLakhs(lead))})`
            : `${lead.name} - no contact in ${days} days (${fmt(leadValueLakhs(lead))})`
        );
      });

    const overdue = reminders.filter((r) => !r.isCompleted && r.isOverdue).length;
    if (overdue > 0) out.push(`${overdue} overdue follow-up${overdue > 1 ? 's' : ''}`);

    return out;
  }, [leads, reminders, asOf]);

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
    <div className="page-stack">
      {/* ═══ HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Insights</h1>
          <p className="text-sm text-slate-500">AI-powered performance overview</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {(['7 Days', '30 Days', '90 Days'] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${range === r ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
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
          { label: 'Overdue Follow-ups', value: String(overdueCount), icon: Clock, color: 'text-amber-600 bg-amber-50', sub: `of ${reminders.length} reminders` },
        ] as const).map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">{c.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.color}`}><Icon size={16} /></div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{c.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ═══ WEIGHTED PIPELINE FORECAST ═════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-purple-600 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#7C3AED]" />
            <h3 className="text-sm font-bold text-slate-900">Weighted Pipeline Forecast</h3>
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">Open deals</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Stage-weighted, not a prediction
          </span>
        </div>

        <div className="flex gap-6">
          {/* Weighted value */}
          <div className="flex-1">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">Weighted Value</p>
            <p className="text-3xl font-bold text-slate-900">{fmt(forecast.weightedLakhs)}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              from {fmt(sumLeadValueLakhs(leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost')))} of open pipeline
            </p>
            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              New 10% · Contacted 20% · Qualified 40% · Negotiation 70%
            </p>
          </div>

          <div className="w-px bg-slate-100 shrink-0" />

          {/* Open deals by stage */}
          <div className="flex-1">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">Open Deals</p>
            <p className="text-3xl font-bold text-slate-900">
              {forecast.openCount} {forecast.openCount === 1 ? 'deal' : 'deals'}
            </p>
            <div className="mt-3 space-y-1.5">
              {forecast.byStage.length === 0 ? (
                <p className="text-xs text-slate-400">No open deals.</p>
              ) : (
                forecast.byStage.map(([stage, count]) => (
                  <p key={stage} className="text-xs text-slate-600">
                    {count} in {stage}
                  </p>
                ))
              )}
            </div>
          </div>

          <div className="w-px bg-slate-100 shrink-0" />

          {/* Risks, derived */}
          <div className="flex-1">
            <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wide mb-2">Pipeline Risks</p>
            <div className="space-y-1.5">
              {risks.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nothing stale or overdue right now.
                </p>
              ) : (
                risks.map((risk) => (
                  <div key={risk} className="bg-amber-50 rounded p-2">
                    <p className="text-xs text-amber-800">{risk}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ROW 2 — LINE + PIE ══════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Line Chart */}
        <div className="xl:col-span-3 bg-white rounded-xl shadow-sm border border-slate-100 p-6 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Lead Acquisition Trend</h3>
          </div>
          {trendError ? (
            <p className="h-[250px] flex items-center justify-center text-xs text-red-600">
              {trendError}
            </p>
          ) : trend.length === 0 ? (
            <p className="h-[250px] flex items-center justify-center text-xs text-slate-400">
              Not enough history yet.
            </p>
          ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="newLeads" name="New Leads" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="converted" name="Converted" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Lead Sources</h3>
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
              <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[d.name] }} />
                {d.name} ({d.value}) {sourceTotal ? `${Math.round((d.value / sourceTotal) * 100)}%` : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ ROW 3 — FUNNEL ══════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Filter size={16} className="text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Sales Pipeline Funnel</h3>
        </div>
        <div className="space-y-3">
          {funnelData.map((f, i) => (
            <div key={f.stage} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600 w-24 shrink-0 text-right">{f.stage}</span>
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
                  <span className="text-[10px] text-slate-400">100%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ ROW 4 — SOURCE PERF + AI INSIGHTS ═══════════════ */}
      <div className="flex gap-4">
        {/* Source Performance */}
        <div className="w-1/2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Source Performance</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-slate-500 border-b border-slate-100">
                <th className="pb-2 text-left font-medium">Source</th>
                <th className="pb-2 text-center font-medium">Leads</th>
                <th className="pb-2 text-center font-medium">Won</th>
                <th className="pb-2 text-center font-medium">Conv Rate</th>
                <th className="pb-2 text-center font-medium">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {sourcePerfData.map((s, i) => (
                <tr key={s.source} className="border-b border-slate-50">
                  <td className="py-2 font-medium text-slate-800 flex items-center gap-1.5">
                    {i === 0 && <Star size={12} className="text-amber-500 fill-amber-500" />}
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[s.source] }} />
                    {s.source}
                  </td>
                  <td className="py-2 text-center text-slate-600">{s.leads}</td>
                  <td className="py-2 text-center text-slate-600">{s.won}</td>
                  <td className="py-2 text-center font-semibold text-slate-800">{s.rate.toFixed(1)}%</td>
                  <td className="py-2 text-center text-slate-600">{s.avgScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI Insights */}
        <div className="w-1/2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-[#7C3AED]" />
            <h3 className="text-sm font-bold text-slate-900">AI Insights</h3>
          </div>
          {/* Derived from the loaded leads, so every line is checkable against
              the pipeline. The previous panel was five hardcoded strings with
              invented confidence percentages. */}
          <div className="space-y-2">
            {insights.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Add a few leads to see pipeline observations here.
              </p>
            ) : (
              insights.map((ins) => (
                <div key={ins.text} className="bg-purple-50 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-sm shrink-0">{ins.emoji}</span>
                  <p className="text-xs text-slate-700 flex-1">{ins.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM — TEAM PERFORMANCE ═══════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Team Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-slate-500 border-b border-slate-100">
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
                <tr key={t.name} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {t.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <span className="font-medium text-slate-800">{t.name}</span>
                      {i === 0 && <span title="Top performer">👑</span>}
                    </div>
                  </td>
                  <td className="py-3 text-center text-slate-600">{t.assigned}</td>
                  <td className="py-3 text-center text-slate-600">{t.contacted}</td>
                  <td className="py-3 text-center text-slate-600">{t.qualified}</td>
                  <td className="py-3 text-center font-semibold text-slate-800">{t.won}</td>
                  <td className="py-3 text-center font-semibold text-slate-800">{t.rate.toFixed(1)}%</td>
                  <td className="py-3 text-center text-slate-600">{t.avgScore}</td>
                  <td className="py-3 pl-3 w-36">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
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
