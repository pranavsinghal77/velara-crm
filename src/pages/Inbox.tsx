import React from 'react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { MessageSquare, Send, Phone, Video, Sparkles, X, RefreshCw, ShieldAlert, AlertTriangle, Zap, Check, Copy } from 'lucide-react';
import { ApiError, api } from '../lib/api';
import { useCrmStore } from '../store/useCrmStore';
import type { Message, Lead } from '../types/models';

// ─── constants ────────────────────────────────────────────────────────────────

type Channel = 'WhatsApp' | 'Email' | 'SMS';
const CHANNELS: Channel[] = ['WhatsApp', 'Email', 'SMS'];

const sourceBadge: Record<string, string> = {
  JustDial: 'bg-blue-100 text-blue-700',
  IndiaMART: 'bg-orange-100 text-orange-700',
  Website: 'bg-green-100 text-green-700',
  WhatsApp: 'bg-teal-100 text-teal-700',
  Referral: 'bg-purple-100 text-purple-700',
};

function scoreColor(s: number) {
  if (s > 75) return 'text-green-600 border-green-500';
  if (s >= 50) return 'text-orange-600 border-orange-500';
  return 'text-red-600 border-red-500';
}

const quickReplies = [
  'Namaste! Thank you for your interest 🙏',
  "Sure, I'll send the proposal by EOD today",
  'Can we schedule a call tomorrow at 11 AM?',
];

const DEFAULT_SMART_REPLIES = [
  "Namaste! Thank you for reaching out. I'll get back to you with the details shortly. 🙏",
  'Sure, I can arrange a demo call. What time works best for you?',
  "I'll send you the proposal and pricing sheet by end of day today.",
];

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function dateSep(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

interface SentimentData {
  sentiment: string;
  frustrationScore: number;
  frustrationDelta: number;
  signals: string[];
  sanitizedSummary: string;
  toneAnalysis: string;
  shouldEscalate: boolean;
  recommendedTier: number;
}

interface EscalationDossier {
  tierName: string;
  executiveBrief: string;
  rootCause: string;
  recommendedAction: string;
  readyToReply: string;
  keyFacts: string[];
  urgency: string;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Inbox() {
  const messages = useCrmStore((s) => s.messages);
  const addMessage = useCrmStore((s) => s.addMessage);
  const markMessageRead = useCrmStore((s) => s.markMessageRead);
  const leads = useCrmStore((s) => s.leads);

  const [activeChannel, setActiveChannel] = useState<Channel>('WhatsApp');
  const [selectedLead, setSelectedLead] = useState<string | null>('lead_1');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [replySeed, setReplySeed] = useState(0);

  // BiteDash / ZeroBT AI Integration states
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [isSentimentLoading, setIsSentimentLoading] = useState(false);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(3);
  const [dossier, setDossier] = useState<EscalationDossier | null>(null);
  const [isDossierLoading, setIsDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState('');
  const [copied, setCopied] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ── filter channel messages ──────────────────────────────
  const channelMessages = useMemo(
    () => messages.filter((m) => m.channel === activeChannel),
    [messages, activeChannel],
  );

  // ── group by leadId ──────────────────────────────────────
  const conversations = useMemo(() => {
    const map = new Map<string, Message[]>();
    for (const msg of channelMessages) {
      if (!map.has(msg.leadId)) map.set(msg.leadId, []);
      map.get(msg.leadId)!.push(msg);
    }
    return Array.from(map.entries()).map(([leadId, msgs]) => {
      msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const last = msgs[msgs.length - 1];
      const unread = msgs.some((m) => !m.isRead && m.sender === 'received');
      return { leadId, msgs, last, unread };
    });
  }, [channelMessages]);

  // ── filter by search ─────────────────────────────────────
  const filteredConvos = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const lead = leads.find((l) => l.id === c.leadId);
      const name = (lead?.name ?? c.leadId).toLowerCase();
      const lastText = c.last.content.toLowerCase();
      return name.includes(q) || lastText.includes(q);
    });
  }, [conversations, search, leads]);

  // ── active conversation ──────────────────────────────────
  const activeConvo = useMemo(
    () => conversations.find((c) => c.leadId === selectedLead) ?? null,
    [conversations, selectedLead],
  );

  const activeLead: Lead | undefined = useMemo(
    () => leads.find((l) => l.id === selectedLead),
    [leads, selectedLead],
  );

  // ── auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConvo?.msgs]);

  // ── mark read ────────────────────────────────────────────
  useEffect(() => {
    if (!activeConvo) return;
    activeConvo.msgs
      .filter((m) => !m.isRead && m.sender === 'received')
      .forEach((m) => markMessageRead(m.id));
  }, [selectedLead, activeConvo, markMessageRead]);

  const [smartReplies, setSmartReplies] = useState<string[]>(DEFAULT_SMART_REPLIES);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  // ── Fetch AI Smart Replies & Sentiment Analysis ─────────
  useEffect(() => {
    // Set when the effect is torn down, so a slow response for a conversation
    // the user has already navigated away from is discarded instead of
    // overwriting the current one.
    let ignore = false;

    const fetchAiData = async () => {
      const convo = conversations.find((c) => c.leadId === selectedLead);
      const lastReceived = convo?.msgs.filter((m) => m.sender === 'received').at(-1);
      
      if (!lastReceived) {
        setSmartReplies(DEFAULT_SMART_REPLIES);
        setSentiment(null);
        return;
      }

      setIsAiLoading(true);
      setIsSentimentLoading(true);

      const history =
        convo?.msgs.slice(-5).map((m) => ({ sender: m.sender, content: m.content })) ?? [];

      // Settled, not all-or-nothing: a sentiment failure should not also wipe
      // the smart replies. Each result is applied independently and a failure
      // falls back to the generic canned replies, which are clearly labelled
      // as such rather than dressed up as model output.
      const [replyResult, sentimentResult] = await Promise.allSettled([
        api.post<{ reply: string }>('/ai/smart-reply', { message: lastReceived.content }),
        api.post<SentimentData & { recommendedTier?: number }>('/ai/sentiment-analysis', {
          message: lastReceived.content,
          history,
        }),
      ]);

      if (ignore) return;

      if (replyResult.status === 'fulfilled') {
        setSmartReplies([
          replyResult.value.reply,
          "I'll send you the details shortly.",
          "Let's schedule a call.",
        ]);
        setAiUnavailable(false);
      } else {
        setSmartReplies(DEFAULT_SMART_REPLIES);
        setAiUnavailable(
          replyResult.reason instanceof ApiError && replyResult.reason.status === 503
        );
      }

      if (sentimentResult.status === 'fulfilled') {
        setSentiment(sentimentResult.value);
        if (sentimentResult.value.recommendedTier) {
          setSelectedTier(sentimentResult.value.recommendedTier);
        }
      } else {
        // No invented frustration score.
        setSentiment(null);
      }

      setIsAiLoading(false);
      setIsSentimentLoading(false);
    };
    
    void fetchAiData();

    return () => {
      ignore = true;
    };
  }, [selectedLead, replySeed, conversations]);

  function refreshSmartReplies() {
    setReplySeed((seed) => seed + 1);
  }

  // ── Trigger Escalation Dossier Generator ─────────────────
  async function generateEscalationDossier() {
    if (!activeLead) return;
    setIsDossierLoading(true);
    setShowEscalationModal(true);
    setDossierError('');
    try {
      const data = await api.post<EscalationDossier>('/ai/escalate', {
        leadId: activeLead.id,
        leadName: activeLead.name,
        company: activeLead.company,
        budget: activeLead.budget,
        targetTier: selectedTier,
        messages:
          activeConvo?.msgs.slice(-20).map((m) => ({ sender: m.sender, content: m.content })) ?? [],
      });
      setDossier(data);
    } catch (err) {
      setDossier(null);
      setDossierError(
        err instanceof ApiError
          ? err.status === 503
            ? 'AI escalation is unavailable right now. No dossier was generated.'
            : err.message
          : 'Could not generate the dossier. Please try again.'
      );
    } finally {
      setIsDossierLoading(false);
    }
  }

  const unreadTotal = useMemo(
    () => messages.filter((m) => !m.isRead && m.sender === 'received' && m.channel === activeChannel).length,
    [messages, activeChannel],
  );

  // ── send message ─────────────────────────────────────────
  function handleSend() {
    if (!input.trim() || !selectedLead) return;
    const newMsg: Message = {
      id: 'msg_' + Date.now(),
      leadId: selectedLead,
      content: input.trim(),
      sender: 'sent',
      timestamp: new Date().toISOString(),
      channel: activeChannel,
      isRead: true,
      isAISuggested: false,
    };
    addMessage(newMsg);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden page-fill relative">
      {/* ═══ LEFT PANEL ═══════════════════════════════════════ */}
      <div className="w-[35%] min-w-[280px] border-r border-slate-200 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-slate-900">Unified Inbox</h2>
            {unreadTotal > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {unreadTotal} unread
              </span>
            )}
          </div>

          {/* Channel tabs */}
          <div className="flex border-b border-slate-200">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                onClick={() => { setActiveChannel(ch); setSelectedLead(null); }}
                className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                  activeChannel === ch
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mt-2.5">
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConvos.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-400">No conversations found</div>
          )}
          {filteredConvos.map((c) => {
            const lead = leads.find((l) => l.id === c.leadId);
            const isSelected = c.leadId === selectedLead;
            return (
              <button
                key={c.leadId}
                onClick={() => setSelectedLead(c.leadId)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all duration-200 border-b border-transparent ${
                  isSelected ? 'bg-blue-50/60 border-b-blue-100 shadow-sm' : 'hover:bg-slate-50 hover:shadow-sm'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                  {(lead?.name ?? c.leadId).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {lead?.name ?? c.leadId}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                      {formatTime(c.last.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {lead && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sourceBadge[lead.source]}`}>
                        {lead.source}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-slate-400 truncate">
                      {c.last.content.slice(0, 40)}{c.last.content.length > 40 ? '…' : ''}
                    </p>
                    {c.unread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ml-1" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ RIGHT PANEL ══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedLead || !activeLead ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <MessageSquare size={48} className="text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">Select a conversation to start messaging</h3>
            <p className="text-sm text-slate-400 mt-1">All your WhatsApp, Email and SMS in one place</p>
          </div>
        ) : (
          <>
            {/* ── Top bar ──────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0 glass-panel">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                  {activeLead.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">{activeLead.name}</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sourceBadge[activeLead.source]}`}>
                      {activeLead.source}
                    </span>
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 text-[10px] font-bold ${scoreColor(activeLead.aiScore)}`}>
                      {activeLead.aiScore}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {activeLead.company ? `${activeLead.company} • ` : ''}Budget: {activeLead.budget || '₹3L'} • via {activeChannel}
                  </p>
                </div>
              </div>

              {/* Action Buttons & ZeroBT Escalation Trigger */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={generateEscalationDossier}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white text-xs font-bold shadow-sm transition-all"
                  title="Generate Executive Escalation Dossier"
                >
                  <Zap size={13} className="text-yellow-200 fill-yellow-200" />
                  <span>Escalate to Tier {selectedTier}</span>
                </button>
                <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><Phone size={18} /></button>
                <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><Video size={18} /></button>
              </div>
            </div>

            {/* ── BiteDash Frustration & Sentiment Radar Bar ──────── */}
            {isSentimentLoading && !sentiment && (
              <div className="px-4 py-2 bg-slate-900 text-slate-300 text-xs shrink-0 border-b border-slate-700/50 flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                Reading sentiment...
              </div>
            )}
            {sentiment && (
              <div className="px-4 py-2 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between gap-4 text-xs shrink-0 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert size={15} className={sentiment.frustrationScore > 60 ? 'text-red-400 animate-pulse' : 'text-emerald-400'} />
                    <span className="font-bold tracking-wide">Frustration Radar:</span>
                  </div>
                  
                  {/* Gauge */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          sentiment.frustrationScore > 70
                            ? 'bg-red-500'
                            : sentiment.frustrationScore > 40
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.max(8, sentiment.frustrationScore)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-200">
                      {sentiment.frustrationScore}/100
                    </span>
                  </div>

                  {/* Sentiment Badge */}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    sentiment.sentiment === 'angry' || sentiment.sentiment === 'distressed'
                      ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                      : sentiment.sentiment === 'positive'
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {sentiment.sentiment}
                  </span>
                </div>

                {/* Risk Signals */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {sentiment.signals.map((sig) => (
                    <span key={sig} className="px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/60 text-[10px] font-semibold flex items-center gap-1">
                      <AlertTriangle size={10} />
                      {sig.replace('_', ' ')}
                    </span>
                  ))}
                  {sentiment.shouldEscalate && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                      Escalation Warranted
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Messages area ─────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#F8FAFC] space-y-1">
              {activeConvo?.msgs.map((msg, idx, arr) => {
                const prevDate = idx > 0 ? dateSep(arr[idx - 1].timestamp) : null;
                const curDate = dateSep(msg.timestamp);
                const showDate = curDate !== prevDate;
                const isSent = msg.sender === 'sent';

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center my-3">
                        <span className="text-[10px] text-slate-400 bg-slate-200/60 px-3 py-0.5 rounded-full">
                          {curDate}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex mb-1 ${
                        isSent ? 'justify-end anim-slide-right' : 'justify-start anim-slide-left'
                      }`}
                    >
                      <div
                        className={`max-w-[75%] px-3.5 py-2 text-sm whitespace-pre-wrap ${
                          isSent
                            ? 'bg-[#2563EB] text-white rounded-2xl rounded-br-sm'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-bl-sm'
                        }`}
                      >
                        {msg.content}
                        <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : ''}`}>
                          <span className={`text-[10px] ${isSent ? 'text-blue-200' : 'text-slate-400'}`}>
                            {formatTime(msg.timestamp)}
                          </span>
                          {isSent && (
                            <span className="text-[10px] text-blue-200">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* ── Quick reply chips ─────────────────────────────── */}
            <div className="flex gap-2 px-4 py-2 border-t border-slate-100 overflow-x-auto shrink-0 bg-white">
              {quickReplies.map((r) => (
                <button
                  key={r}
                  onClick={() => setInput(r)}
                  className="text-[11px] text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-full whitespace-nowrap transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>

            {/* ── AI Smart Replies (Upscaled with Gemini) ──────── */}
            <div className="mx-3 mb-2 rounded-xl p-[2px] shrink-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-sm">
              <div className="bg-white rounded-[10px] p-3 h-full w-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <span className="text-xs font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-purple-700">
                      Gemini Smart Replies & Intent
                    </span>
                  </div>
                  <button
                    onClick={refreshSmartReplies}
                    className="p-1 rounded-full text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    title="Refresh suggestions"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
                {aiUnavailable && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mb-1.5">
                    AI is unavailable, so these are generic templates rather than
                    suggestions for this thread.
                  </p>
                )}
                <div className="flex flex-col gap-1.5">
                  {isAiLoading ? (
                    <div className="flex items-center justify-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="ml-2 text-xs font-medium text-purple-600 inline-flex items-center gap-1.5">
                        Gemini is analysing this thread
                        <span className="typing" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                      </span>
                    </div>
                  ) : (
                    smartReplies.map((reply, index) => (
                      <button
                        key={index}
                        onClick={() => setInput(reply)}
                        className="text-left text-xs bg-purple-50/50 hover:bg-purple-100/60 text-purple-900 p-2 rounded-lg border border-purple-100/80 transition-all duration-200 flex items-center justify-between group"
                      >
                        <span className="line-clamp-1">{reply}</span>
                        <span className="text-[10px] text-purple-400 group-hover:text-purple-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-2">
                          Use ↵
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ── Input bar ─────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 shrink-0 bg-white">
              <input
                type="text"
                placeholder={`Type a message on ${activeChannel}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={`p-2.5 rounded-xl text-white transition-all shadow-sm ${
                  input.trim()
                    ? 'bg-[#2563EB] hover:bg-blue-700 scale-100'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ═══ ZERO-BT MULTI-TIER ESCALATION DOSSIER MODAL ═══════ */}
      {showEscalationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overlay-enter">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden modal-enter">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-red-600 via-orange-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Zap size={20} className="text-yellow-300 fill-yellow-300" />
                <div>
                  <h3 className="font-bold text-base">Executive Escalation Dossier</h3>
                  <p className="text-xs text-orange-100">ZeroBT Tier Routing & High-Stakes Grievance Resolution</p>
                </div>
              </div>
              <button
                onClick={() => setShowEscalationModal(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Hierarchy Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">
                  Target Escalation Tier:
                </label>
                <select
                  value={selectedTier}
                  onChange={(e) => {
                    setSelectedTier(Number(e.target.value));
                  }}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value={1}>Tier 1: Junior Sales SDR</option>
                  <option value={2}>Tier 2: Account Executive</option>
                  <option value={3}>Tier 3: Senior Sales Manager</option>
                  <option value={4}>Tier 4: Head of Field Operations</option>
                  <option value={5}>Tier 5: VP of Enterprise Sales</option>
                  <option value={6}>Tier 6: Customer Success Director</option>
                  <option value={7}>Tier 7: Business Director</option>
                  <option value={8}>Tier 8: Founder (Pranav Singhal)</option>
                </select>
              </div>

              {isDossierLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-semibold text-slate-600 animate-pulse">ZeroBT is generating executive briefing and VIP resolution template...</p>
                </div>
              ) : dossier ? (
                <div className="space-y-4">
                  {/* Executive Brief */}
                  <div className="p-3.5 bg-orange-50/80 rounded-xl border border-orange-200">
                    <span className="text-[11px] font-bold text-orange-800 uppercase tracking-wider block mb-1">Executive Brief</span>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">{dossier.executiveBrief}</p>
                  </div>

                  {/* Root Cause & Recommended Tactical Action */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-red-50/60 rounded-xl border border-red-100">
                      <span className="text-[10px] font-bold text-red-700 uppercase block mb-1">Root Cause / Blocker</span>
                      <p className="text-xs text-slate-700">{dossier.rootCause}</p>
                    </div>
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">Recommended Action</span>
                      <p className="text-xs text-slate-700">{dossier.recommendedAction}</p>
                    </div>
                  </div>

                  {/* Key Deal Facts */}
                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-1.5">Key Deal & Operational Facts:</span>
                    <ul className="grid grid-cols-2 gap-2">
                      {dossier.keyFacts?.map((fact, i) => (
                        <li key={i} className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                          <Check size={12} className="text-emerald-600 shrink-0" />
                          <span className="truncate">{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* VIP Ready-to-Reply Template */}
                  <div className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-xl text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-orange-300">VIP Resolution Message Template:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(dossier.readyToReply);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-orange-200 hover:text-white bg-white/10 px-2 py-1 rounded"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'Copied!' : 'Copy Template'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-200 font-mono bg-black/40 p-3 rounded-lg border border-white/10 whitespace-pre-wrap">
                      {dossier.readyToReply}
                    </p>
                  </div>
                </div>
              ) : dossierError ? (
                <div className="py-10 px-4 text-center">
                  <p className="text-xs font-semibold text-red-600">{dossierError}</p>
                  <button
                    onClick={() => void generateEscalationDossier()}
                    className="mt-3 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-100"
                  >
                    Try again
                  </button>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={generateEscalationDossier}
                className="text-xs text-slate-600 font-semibold hover:text-slate-900"
              >
                Regenerate Dossier
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEscalationModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Close
                </button>
                {dossier && (
                  <button
                    onClick={() => {
                      setInput(dossier.readyToReply);
                      setShowEscalationModal(false);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
                  >
                    Insert Template into Chat
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
