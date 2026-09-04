import { useMemo, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { Sparkles, Search, CheckCircle2, AlertTriangle, LifeBuoy, Zap, X, BookOpen } from 'lucide-react';

type TicketStatus = 'Open' | 'Investigating' | 'Resolved';

type Ticket = {
  id: string;
  title: string;
  area: string;
  client: string;
  severity: 'High' | 'Medium' | 'Low';
  frustrationScore: number;
  tier: string;
  tierNum: number;
  status: TicketStatus;
  owner: string;
};

const initialTickets: Ticket[] = [
  {
    id: 'SUP-301',
    title: 'Tally GST invoice e-way sync failing for Maharashtra branch',
    area: 'Integrations / Accounting',
    client: 'Kumar Enterprises',
    severity: 'High',
    frustrationScore: 84,
    tier: 'Tier 3: Senior Sales Manager',
    tierNum: 3,
    status: 'Investigating',
    owner: 'Platform Ops',
  },
  {
    id: 'SUP-302',
    title: 'WhatsApp broadcast rate limit delay during flash promo',
    area: 'Inbox / WhatsApp API',
    client: 'Sharma Textiles',
    severity: 'Medium',
    frustrationScore: 62,
    tier: 'Tier 2: Account Executive',
    tierNum: 2,
    status: 'Open',
    owner: 'Sneha Kapoor',
  },
  {
    id: 'SUP-303',
    title: 'Multi-currency invoice formatting for exports',
    area: 'Lead Pipeline',
    client: 'Nair Exports',
    severity: 'Low',
    frustrationScore: 28,
    tier: 'Tier 1: Junior Sales SDR',
    tierNum: 1,
    status: 'Resolved',
    owner: 'Karan Malhotra',
  },
  {
    id: 'SUP-304',
    title: 'Comparing enterprise quote with Zoho CRM — requesting discount',
    area: 'Enterprise Sales',
    client: 'Verma Associates',
    severity: 'High',
    frustrationScore: 78,
    tier: 'Tier 7: Business Director',
    tierNum: 7,
    status: 'Open',
    owner: 'Pranav Singhal',
  },
];

interface EscalationDossier {
  tierName: string;
  executiveBrief: string;
  rootCause: string;
  recommendedAction: string;
  readyToReply: string;
  keyFacts: string[];
  urgency: 'Medium' | 'High' | 'Critical';
}

interface RagAnswer {
  answer: string;
  citations: string[];
  confidence: number;
  suggestedFollowUp: string | null;
  answeredFromContext: boolean;
}

export default function Support() {
  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState(initialTickets);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketClient, setTicketClient] = useState('');
  const [ticketArea, setTicketArea] = useState('General');
  const [ticketSeverity, setTicketSeverity] = useState<'High' | 'Medium' | 'Low'>('Medium');

  // Escalation Dossier State
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [dossier, setDossier] = useState<EscalationDossier | null>(null);
  const [isDossierLoading, setIsDossierLoading] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // RAG Query State
  const [ragQuery, setRagQuery] = useState('');
  const [ragAnswer, setRagAnswer] = useState<RagAnswer | null>(null);
  const [aiError, setAiError] = useState('');
  const [isRagLoading, setIsRagLoading] = useState(false);

  function createTicket() {
    if (!ticketTitle.trim()) {
      setNotice('Please enter a ticket title first.');
      return;
    }
    const nextNumber = 300 + tickets.length + 1;
    const newTicket: Ticket = {
      id: `SUP-${nextNumber}`,
      title: ticketTitle.trim(),
      client: ticketClient.trim() || 'General Client',
      area: ticketArea,
      severity: ticketSeverity,
      frustrationScore: ticketSeverity === 'High' ? 75 : ticketSeverity === 'Medium' ? 45 : 20,
      tier: ticketSeverity === 'High' ? 'Tier 3: Senior Sales Manager' : 'Tier 1: Junior Sales SDR',
      tierNum: ticketSeverity === 'High' ? 3 : 1,
      status: 'Open',
      owner: 'Support Queue',
    };
    setTickets([newTicket, ...tickets]);
    setShowCreate(false);
    setTicketTitle('');
    setTicketClient('');
    setTicketArea('General');
    setTicketSeverity('Medium');
    setNotice('New support incident created with automated ZeroBT triage.');
  }

  async function triggerDossier(ticket: Ticket) {
    setActiveTicket(ticket);
    setShowDossierModal(true);
    setIsDossierLoading(true);
    setAiError('');
    try {
      const data = await api.post<EscalationDossier>('/ai/escalate', {
        leadName: ticket.client,
        company: ticket.client,
        targetTier: ticket.tierNum,
        messages: [{ sender: 'received', content: ticket.title }],
      });
      setDossier(data);
    } catch (err) {
      setDossier(null);
      setAiError(
        err instanceof ApiError && err.status === 503
          ? 'AI escalation is unavailable right now. No dossier was generated.'
          : err instanceof ApiError
            ? err.message
            : 'Could not generate the dossier. Please try again.'
      );
    } finally {
      setIsDossierLoading(false);
    }
  }

  async function handleRagSearch() {
    if (!ragQuery.trim()) return;
    setIsRagLoading(true);
    setAiError('');
    try {
      const data = await api.post<RagAnswer>('/ai/knowledge-query', {
        query: ragQuery.trim(),
      });
      setRagAnswer(data);
    } catch (err) {
      setRagAnswer(null);
      setAiError(
        err instanceof ApiError && err.status === 503
          ? 'The knowledge assistant is unavailable right now.'
          : err instanceof ApiError
            ? err.message
            : 'Could not search the knowledge base. Please try again.'
      );
    } finally {
      setIsRagLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return tickets.filter((ticket) => `${ticket.id} ${ticket.title} ${ticket.area} ${ticket.client}`.toLowerCase().includes(q));
  }, [query, tickets]);

  const openCount = tickets.filter((ticket) => ticket.status !== 'Resolved').length;

  return (
    <div className="page-stack">
      {notice ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="hover:text-blue-900">Dismiss</button>
        </div>
      ) : null}

      {aiError ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 flex items-center justify-between">
          <span>{aiError}</span>
          <button onClick={() => setAiError('')} className="hover:text-red-900">Dismiss</button>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support Command Desk</h1>
          <p className="text-sm text-slate-500">ZeroBT Grievance Redressal, Frustration Radar & Multi-Tier SLA Escalation.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
          <LifeBuoy className="w-4 h-4" />
          Raise Incident Ticket
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold">Active Incidents</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{openCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold">Avg Frustration Index</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">54/100</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold">Avg Response SLA</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">12 min</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold">ZeroBT Auto-Triage</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">98.4%</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-100 p-3.5 flex items-center gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute w-4 h-4 text-slate-400 left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickets by ID, client, or topic..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          ZeroBT Triage Active
        </div>
      </div>

      {/* Ticket Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 text-left">
              <th className="px-4 py-3">Incident / Client</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Frustration Radar</th>
              <th className="px-4 py-3">Escalation Tier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{ticket.id}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">{ticket.client}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{ticket.title}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{ticket.area}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ticket.frustrationScore > 70 ? 'bg-red-500' : ticket.frustrationScore > 40 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${ticket.frustrationScore}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-700">{ticket.frustrationScore}/100</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                    {ticket.tier}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ticket.status === 'Resolved' ? 'bg-green-100 text-green-700' : ticket.status === 'Investigating' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>
                    {ticket.status === 'Resolved' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {ticket.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => triggerDossier(ticket)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold hover:from-orange-600 hover:to-red-600 shadow-sm"
                  >
                    <Zap size={11} className="fill-white" />
                    AI Dossier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Enterprise Knowledge Base RAG Search Copilot */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-bold text-white">Enterprise Knowledge Base & Policy RAG Copilot</h3>
        </div>
        <p className="text-xs text-slate-300 mb-3">
          Search instant answers from your official SLA terms, Tally integration docs, GST rate cards, and billing policies.
        </p>

        <div className="flex gap-2">
          <input
            value={ragQuery}
            onChange={(e) => setRagQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRagSearch()}
            placeholder="e.g. What is the SLA response time for critical tier and annual discount policy?"
            className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={handleRagSearch}
            disabled={isRagLoading || !ragQuery.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-sm"
          >
            {isRagLoading ? 'Retrieving...' : 'Ask Copilot'}
          </button>
        </div>

        {ragAnswer && (
          <div className="mt-4 p-4 rounded-xl bg-white/10 border border-white/15 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-orange-300">Verified Answer:</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                Confidence: {Math.round((ragAnswer.confidence || 0.9) * 100)}%
              </span>
            </div>
            <p className="text-xs text-slate-100 leading-relaxed font-sans">{ragAnswer.answer}</p>
            {ragAnswer.citations.length > 0 && (
              <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-[10px] text-slate-400">
                <span>Citations:</span>
                {ragAnswer.citations.map((c: string, i: number) => (
                  <span key={i} className="bg-black/30 px-2 py-0.5 rounded text-orange-200 font-mono">{c}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Escalation Dossier Modal */}
      {showDossierModal && activeTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overlay-enter">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 modal-enter">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Zap size={20} className="text-orange-500 fill-orange-500" />
                <h3 className="font-bold text-slate-900 text-sm">Escalation Dossier — {activeTicket.id}</h3>
              </div>
              <button onClick={() => setShowDossierModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {isDossierLoading ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-2">
                <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-500">Generating ZeroBT Resolution Protocol...</p>
              </div>
            ) : dossier ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <span className="font-bold text-orange-800 block mb-0.5">Executive Brief</span>
                  <p className="text-slate-800">{dossier.executiveBrief}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">Recommended Tactical Action</span>
                  <p className="text-slate-600">{dossier.recommendedAction}</p>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-white">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-orange-300">Executive Reply Template:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(dossier.readyToReply);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-orange-200"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="font-mono text-slate-200 text-[11px]">{dossier.readyToReply}</p>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDossierModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreate ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overlay-enter">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl p-5 space-y-4 modal-enter">
            <h3 className="text-lg font-semibold text-slate-900">Create Support Incident Ticket</h3>
            <div>
              <label className="text-xs font-semibold text-slate-600">Client / Account Name</label>
              <input
                value={ticketClient}
                onChange={(e) => setTicketClient(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Kumar Enterprises"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Title</label>
              <input
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the issue"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Area</label>
              <input
                value={ticketArea}
                onChange={(e) => setTicketArea(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Inbox / Integrations"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Severity</label>
              <select
                value={ticketSeverity}
                onChange={(e) => setTicketSeverity(e.target.value as 'High' | 'Medium' | 'Low')}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={createTicket} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Create Ticket</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
