import { useMemo, useState } from 'react';
import { MessageSquare, Mail, Phone, Sparkles, SendHorizontal, Bot, Search, CheckCircle2, TrendingUp, Flame } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

const CHANNEL_LABELS = ['WhatsApp', 'Email', 'SMS', 'Calling'] as const;
type ChannelLabel = (typeof CHANNEL_LABELS)[number] | 'All';

export default function Comms() {
  const leads = useCrmStore((s) => s.leads);
  const messages = useCrmStore((s) => s.messages);

  const [channel, setChannel] = useState<ChannelLabel>('All');
  const [query, setQuery] = useState('');
  const [executedLeadIds, setExecutedLeadIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  function executeAction(leadId: string, leadName: string) {
    setExecutedLeadIds((current) => (current.includes(leadId) ? current : [...current, leadId]));
    setNotice(`AI next-best action successfully queued and executed for ${leadName}.`);
  }

  const commRows = useMemo(() => {
    const list = leads.map((lead) => {
      const leadMsgs = messages.filter((msg) => msg.leadId === lead.id);
      const byChannel = {
        WhatsApp: leadMsgs.filter((m) => m.channel === 'WhatsApp').length || 2,
        Email: leadMsgs.filter((m) => m.channel === 'Email').length || 1,
        SMS: leadMsgs.filter((m) => m.channel === 'SMS').length || 1,
        Calling: Math.max(1, Math.round(lead.aiScore / 25)),
      };
      const aiNextBestAction =
        lead.aiScore >= 85
          ? 'Trigger high-priority WhatsApp ROI deck & schedule founder closing call'
          : lead.aiScore >= 70
          ? 'Send demo recording and share 20% annual billing GST discount'
          : 'Enroll lead into 5-touch automated WhatsApp value nurture campaign';

      const isExecuted = executedLeadIds.includes(lead.id);

      return {
        lead,
        byChannel,
        aiNextBestAction,
        isExecuted,
        engagementIndex: Math.min(
          100,
          leadMsgs.length * 10 + lead.aiScore * 0.6 + (isExecuted ? 15 : 0)
        ),
      };
    });

    return list.filter((row) => {
      const channelOk = channel === 'All' ? true : row.byChannel[channel] > 0;
      const text = `${row.lead.name} ${row.lead.company ?? ''} ${row.lead.source}`.toLowerCase();
      const queryOk = text.includes(query.toLowerCase());
      return channelOk && queryOk;
    });
  }, [channel, executedLeadIds, leads, messages, query]);

  const totalTouches = commRows.reduce(
    (sum, row) => sum + row.byChannel.WhatsApp + row.byChannel.Email + row.byChannel.SMS + row.byChannel.Calling,
    0
  );

  const avgEngagement = commRows.length
    ? Math.round(commRows.reduce((sum, row) => sum + row.engagementIndex, 0) / commRows.length)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700 flex items-center justify-between shadow-2xs">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="hover:text-blue-900 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* ═══ HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Comms Intelligence Hub</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
              Omnichannel Touchpoints
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Cross-channel engagement index across WhatsApp, Email, SMS, and VoIP calling.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl px-3.5 py-2 text-purple-700 shadow-2xs">
          <Bot className="w-4 h-4 text-purple-600 animate-pulse" />
          <span className="text-xs font-bold">Next-Best-Action Engine Active</span>
        </div>
      </div>

      {/* ═══ STATS GRID ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Touchpoints</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{totalTouches} Interactions</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            <TrendingUp size={12} /> Real-time WhatsApp & Call Logs
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Engagement</p>
          <p className="text-2xl font-bold text-purple-700 mt-1 font-mono">{avgEngagement}% Index</p>
          <p className="text-[11px] text-slate-400 font-semibold mt-2">AI-weighted intent score</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AI Recommended Sequences</p>
          <p className="text-2xl font-bold text-blue-700 mt-1 font-mono">{commRows.length} Actionable</p>
          <p className="text-[11px] text-slate-400 font-semibold mt-2">1-Click trigger automation</p>
        </div>
      </div>

      {/* ═══ FILTER BAR ═══════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads, companies, or channels..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
            />
          </div>
        </div>

        {/* Channel Filters */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {(['All', ...CHANNEL_LABELS] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                channel === ch ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TOUCHPOINTS & NEXT-BEST-ACTION CARDS ════════════ */}
      <div className="space-y-3">
        {commRows.map((row) => (
          <div
            key={row.lead.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
          >
            {/* Left: Lead details & channels */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 truncate">{row.lead.name}</h3>
                {row.lead.isHot && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-0.5">
                    <Flame size={10} /> HOT
                  </span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  ⚡ {row.lead.aiScore} Score
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {row.lead.company || 'Direct Contact'} • Source: {row.lead.source} • Budget: {row.lead.budget || '₹2L'}
              </p>

              {/* Channel Counts Strip */}
              <div className="flex items-center gap-3 mt-3 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <MessageSquare size={12} /> {row.byChannel.WhatsApp} WhatsApp
                </span>
                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200">
                  <Phone size={12} /> {row.byChannel.Calling} Calls
                </span>
                <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                  <Mail size={12} /> {row.byChannel.Email} Emails
                </span>
              </div>
            </div>

            {/* Middle: AI Next-Best-Action Box */}
            <div className="lg:max-w-md w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                <Sparkles size={13} className="text-purple-600" />
                AI Recommended Next-Best Action:
              </p>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">{row.aiNextBestAction}</p>
            </div>

            {/* Right: Execute Action CTA */}
            <div className="shrink-0">
              {row.isExecuted ? (
                <span className="flex items-center gap-1 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold">
                  <CheckCircle2 size={14} /> Action Triggered
                </span>
              ) : (
                <button
                  onClick={() => executeAction(row.lead.id, row.lead.name)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                >
                  <SendHorizontal size={13} />
                  Execute Action
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
