import { useMemo, useState } from 'react';
import { Sparkles, Search, CheckCircle2, AlertTriangle, LifeBuoy, MessageCircle } from 'lucide-react';

type TicketStatus = 'Open' | 'Investigating' | 'Resolved';

type Ticket = {
  id: string;
  title: string;
  area: string;
  severity: 'High' | 'Medium' | 'Low';
  status: TicketStatus;
  owner: string;
};

const initialTickets: Ticket[] = [
  {
    id: 'SUP-301',
    title: 'WhatsApp webhook delay for inbound leads',
    area: 'Inbox / Integrations',
    severity: 'High',
    status: 'Investigating',
    owner: 'Platform Ops',
  },
  {
    id: 'SUP-302',
    title: 'CSV export formatting for INR budgets',
    area: 'Lead Pipeline',
    severity: 'Medium',
    status: 'Open',
    owner: 'Data Team',
  },
  {
    id: 'SUP-303',
    title: 'VoIP transcript punctuation quality',
    area: 'Calling Center',
    severity: 'Low',
    status: 'Resolved',
    owner: 'AI Ops',
  },
];

const helpArticles = [
  'How to set AI lead-score threshold by team segment',
  'Best-practice cadence for B2B India outbound follow-ups',
  'How to configure role-based permissions for managers',
  'Troubleshooting WhatsApp and IndiaMART ingestion',
];

export default function Support() {
  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState(initialTickets);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketArea, setTicketArea] = useState('General');
  const [ticketSeverity, setTicketSeverity] = useState<'High' | 'Medium' | 'Low'>('Medium');

  function createTicket() {
    if (!ticketTitle.trim()) {
      setNotice('Please enter a ticket title first.');
      return;
    }
    const nextNumber = 300 + tickets.length + 1;
    setTickets((current) => [
      {
        id: `SUP-${nextNumber}`,
        title: ticketTitle.trim(),
        area: ticketArea,
        severity: ticketSeverity,
        status: 'Open',
        owner: 'Support Queue',
      },
      ...current,
    ]);
    setShowCreate(false);
    setTicketTitle('');
    setTicketArea('General');
    setTicketSeverity('Medium');
    setNotice('New support ticket created and assigned to queue.');
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return tickets.filter((ticket) => `${ticket.id} ${ticket.title} ${ticket.area}`.toLowerCase().includes(q));
  }, [query, tickets]);

  const openCount = tickets.filter((ticket) => ticket.status !== 'Resolved').length;

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
          <h1 className="text-2xl font-bold text-gray-900">Support Command</h1>
          <p className="text-sm text-gray-500">Operational excellence desk for product, AI, and integration support.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
          <LifeBuoy className="w-4 h-4" />
          Raise Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Open Incidents</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{openCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Avg Response SLA</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">18 min</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">AI Triage Accuracy</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">93%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute w-4 h-4 text-gray-400 left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickets"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold">
          <Sparkles className="w-4 h-4" />
          AI Triage On
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 text-left">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ticket) => (
              <tr key={ticket.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{ticket.id}</p>
                  <p className="text-xs text-gray-500">{ticket.title}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{ticket.area}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${ticket.severity === 'High' ? 'bg-red-100 text-red-700' : ticket.severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {ticket.severity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${ticket.status === 'Resolved' ? 'bg-green-100 text-green-700' : ticket.status === 'Investigating' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-700'}`}>
                    {ticket.status === 'Resolved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {ticket.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{ticket.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-900 inline-flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-blue-600" />
            Suggested Knowledge Articles
          </h3>
          <div className="mt-3 space-y-2">
            {helpArticles.map((article) => (
              <p key={article} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                {article}
              </p>
            ))}
          </div>
        </article>

        <article className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-violet-900">AI Resolution Assistant</h3>
          <p className="text-sm text-violet-800 mt-2">
            Based on the current ticket queue, prioritize webhook reliability and transcript normalization. Recommended playbook has been drafted for platform ops.
          </p>
        </article>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-xl p-5 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Create Support Ticket</h3>
            <div>
              <label className="text-xs font-semibold text-gray-600">Title</label>
              <input
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the issue"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Area</label>
              <input
                value={ticketArea}
                onChange={(e) => setTicketArea(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Inbox / Integrations"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Severity</label>
              <select
                value={ticketSeverity}
                onChange={(e) => setTicketSeverity(e.target.value as 'High' | 'Medium' | 'Low')}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={createTicket} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Create Ticket</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
