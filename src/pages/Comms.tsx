import { useMemo, useState } from 'react';
import { MessageSquare, Mail, Phone, Sparkles, Filter, SendHorizontal, Bot } from 'lucide-react';
import { getLeads, getMessages } from '../types/index';

const CHANNEL_LABELS = ['WhatsApp', 'Email', 'SMS', 'Calling'] as const;
type ChannelLabel = (typeof CHANNEL_LABELS)[number] | 'All';

export default function Comms() {
  const leads = useMemo(() => getLeads(), []);
  const messages = useMemo(() => getMessages(), []);

  const [channel, setChannel] = useState<ChannelLabel>('All');
  const [query, setQuery] = useState('');
  const [executedLeadIds, setExecutedLeadIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  function executeAction(leadId: string, leadName: string) {
    setExecutedLeadIds((current) => (current.includes(leadId) ? current : [...current, leadId]));
    setNotice(`AI next-best action queued for ${leadName}.`);
  }

  const commRows = useMemo(() => {
    const list = leads.map((lead) => {
      const leadMsgs = messages.filter((msg) => msg.leadId === lead.id);
      const byChannel = {
        WhatsApp: leadMsgs.filter((m) => m.channel === 'WhatsApp').length,
        Email: leadMsgs.filter((m) => m.channel === 'Email').length,
        SMS: leadMsgs.filter((m) => m.channel === 'SMS').length,
        Calling: Math.max(0, Math.round(lead.aiScore / 20) - 1),
      };
      const aiNextBestAction =
        lead.aiScore >= 85
          ? 'Trigger proposal follow-up and manager escalation within 4 hours'
          : lead.aiScore >= 70
            ? 'Schedule demo reminder and share proof-of-value case study'
            : 'Enroll lead into 5-touch nurture sequence';

      return {
        lead,
        byChannel,
        aiNextBestAction,
        engagementIndex: Math.min(
          100,
          leadMsgs.length * 8 + lead.aiScore * 0.6 + (executedLeadIds.includes(lead.id) ? 8 : 0),
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
    0,
  );

  const avgEngagement = commRows.length
    ? Math.round(commRows.reduce((sum, row) => sum + row.engagementIndex, 0) / commRows.length)
    : 0;

  return (
    <div className="p-6 space-y-5">
      {notice ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="hover:text-blue-900">Dismiss</button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comms Intelligence Hub</h1>
          <p className="text-sm text-gray-500">Unified communication performance across WhatsApp, Email, SMS, and Calls.</p>
        </div>
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-violet-700">
          <Bot className="w-4 h-4" />
          <span className="text-xs font-semibold">AI Copilot Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Tracked Conversations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalTouches}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Average Engagement Index</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{avgEngagement}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">AI Suggested Actions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{commRows.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Filter className="absolute w-4 h-4 text-gray-400 left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lead or source"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['All', ...CHANNEL_LABELS] as const).map((item) => (
            <button
              key={item}
              onClick={() => setChannel(item)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                channel === item ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Channel Mix</th>
              <th className="px-4 py-3">Engagement</th>
              <th className="px-4 py-3">AI Next Best Action</th>
            </tr>
          </thead>
          <tbody>
            {commRows.map((row) => (
              <tr key={row.lead.id} className="border-b border-gray-50 last:border-0 align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{row.lead.name}</p>
                  <p className="text-xs text-gray-500">{row.lead.company ?? 'Independent'} • {row.lead.source}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700"><MessageSquare className="w-3 h-3" /> WA {row.byChannel.WhatsApp}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-blue-100 text-blue-700"><Mail className="w-3 h-3" /> Email {row.byChannel.Email}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-700"><SendHorizontal className="w-3 h-3" /> SMS {row.byChannel.SMS}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-violet-100 text-violet-700"><Phone className="w-3 h-3" /> Calls {row.byChannel.Calling}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${row.engagementIndex}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{Math.round(row.engagementIndex)}%</p>
                </td>
                <td className="px-4 py-3">
                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-2 text-xs text-violet-800 flex gap-2">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <span className="block">{row.aiNextBestAction}</span>
                      <button
                        onClick={() => executeAction(row.lead.id, row.lead.name)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                      >
                        {executedLeadIds.includes(row.lead.id) ? 'Queued' : 'Execute'}
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
