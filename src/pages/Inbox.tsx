import { useState, useMemo, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Image,
  Phone,
  Video,
  MoreVertical,
  Sparkles,
  X,
  RefreshCw,
} from 'lucide-react';
import { getMessages, saveMessages, getLeads } from '../types/index';
import type { Message, Lead } from '../types/index';

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

const aiSuggestions = [
  'Follow up on the proposal sent last week',
  'Best time to call: 10-11 AM based on past responses',
  'Lead score increased — consider closing now',
];

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

function getSmartReplies(lastMsg: string | undefined): string[] {
  if (!lastMsg) return DEFAULT_SMART_REPLIES;
  const m = lastMsg.toLowerCase();
  if (m.includes('price') || m.includes('cost') || m.includes('rate') || m.includes('quote')) {
    return [
      "I'll share the detailed pricing sheet with you shortly. 📋",
      'Our pricing is very competitive. Can we get on a quick call to discuss?',
      "I'll send you the proposal and pricing sheet by end of day today.",
    ];
  }
  if (m.includes('demo') || m.includes('call') || m.includes('meeting') || m.includes('schedule')) {
    return [
      'Sure, I can arrange a demo call. What time works best for you?',
      'I have availability tomorrow 10 AM–12 PM. Shall I block a slot?',
      'Let me know your preferred date and time and I will confirm right away!',
    ];
  }
  if (m.includes('interested') || m.includes('know more') || m.includes('details') || m.includes('more info')) {
    return [
      "Namaste! Thank you for reaching out. I'll get back to you with the details shortly. 🙏",
      'Great! I will share our product brochure and case studies with you.',
      'Happy to help! Can I have 10 minutes for a quick intro call?',
    ];
  }
  return DEFAULT_SMART_REPLIES;
}

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

// ─── component ────────────────────────────────────────────────────────────────

export default function Inbox() {
  const [messages, setMessages] = useState<Message[]>(() => getMessages());
  const leads = useMemo(() => getLeads(), []);
  const leadMap = useMemo(() => {
    const m = new Map<string, Lead>();
    leads.forEach((l) => m.set(l.id, l));
    return m;
  }, [leads]);

  const [activeChannel, setActiveChannel] = useState<Channel>('WhatsApp');
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [showAI, setShowAI] = useState(true);
  const [aiIdx, setAiIdx] = useState(0);
  const [replySeed, setReplySeed] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // rotate AI suggestion
  useEffect(() => {
    const t = setInterval(() => setAiIdx((i) => (i + 1) % aiSuggestions.length), 5000);
    return () => clearInterval(t);
  }, []);

  // scroll on select or new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedLead, messages]);

  // ── grouped conversations ────────────────────────────────
  const conversations = useMemo(() => {
    const byLead = new Map<string, Message[]>();
    messages
      .filter((m) => m.channel === activeChannel)
      .forEach((m) => {
        const arr = byLead.get(m.leadId) || [];
        arr.push(m);
        byLead.set(m.leadId, arr);
      });

    return Array.from(byLead.entries())
      .map(([leadId, msgs]) => {
        const sorted = msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const last = sorted[sorted.length - 1];
        const unread = msgs.some((m) => !m.isRead && m.sender === 'received');
        return { leadId, last, unread, msgs: sorted };
      })
      .sort((a, b) => new Date(b.last.timestamp).getTime() - new Date(a.last.timestamp).getTime());
  }, [messages, activeChannel]);

  const activeConvo = conversations.find((c) => c.leadId === selectedLead);
  const activeLead = selectedLead ? leadMap.get(selectedLead) : null;

  const smartReplies = useMemo(() => {
    const convo = conversations.find((c) => c.leadId === selectedLead);
    const lastReceived = convo?.msgs.filter((m) => m.sender === 'received').at(-1);
    const base = getSmartReplies(lastReceived?.content);
    return replySeed % 2 === 0 ? base : [...base].reverse();
  }, [conversations, replySeed, selectedLead]);

  function refreshSmartReplies() {
    setReplySeed((seed) => seed + 1);
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
    const next = [...messages, newMsg];
    saveMessages(next);
    setMessages(next);
    setInput('');
  }

  function handleAICompose() {
    const leadName = activeLead?.name ?? 'there';
    setInput(
      `Namaste ${leadName} ji! Following up on our previous conversation. I wanted to share that we have a special offer available this week. Shall we schedule a quick call to discuss? 🙏`,
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── render ───────────────────────────────────────────────
  return (
    <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ height: 'calc(100vh - 64px - 48px)' }}>
      {/* ═══ LEFT PANEL ═══════════════════════════════════════ */}
      <div className="w-[35%] min-w-[280px] border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-gray-900">Unified Inbox</h2>
            {unreadTotal > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {unreadTotal} unread
              </span>
            )}
          </div>

          {/* Channel tabs */}
          <div className="flex border-b border-gray-200">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                onClick={() => { setActiveChannel(ch); setSelectedLead(null); }}
                className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                  activeChannel === ch
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-10">No {activeChannel} conversations.</p>
          )}
          {conversations.map((c) => {
            const lead = leadMap.get(c.leadId);
            const initials = lead?.name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) ?? '??';
            const isActive = c.leadId === selectedLead;
            return (
              <button
                key={c.leadId}
                onClick={() => setSelectedLead(c.leadId)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                  isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                {/* avatar */}
                <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {initials}
                </div>
                {/* info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {lead?.name ?? c.leadId}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">
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
                    <p className="text-xs text-gray-400 truncate">
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
          /* ── Empty state ──────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <MessageSquare size={48} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">
              Select a conversation to start messaging
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              All your WhatsApp, Email and SMS in one place
            </p>
          </div>
        ) : (
          <>
            {/* ── Top bar ──────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {activeLead.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{activeLead.name}</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sourceBadge[activeLead.source]}`}>
                      {activeLead.source}
                    </span>
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 text-[10px] font-bold ${scoreColor(activeLead.aiScore)}`}>
                      {activeLead.aiScore}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {activeLead.company ? `${activeLead.company} • ` : ''}via {activeChannel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><Phone size={18} /></button>
                <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><Video size={18} /></button>
                <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><MoreVertical size={18} /></button>
              </div>
            </div>

            {/* ── AI suggestion bar ────────────────────────────── */}
            {showAI && (
              <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border-b border-purple-100 shrink-0">
                <Sparkles size={16} className="text-[#7C3AED] shrink-0" />
                <span className="text-xs text-purple-700 flex-1 truncate">
                  <span className="font-semibold">AI suggests:</span> {aiSuggestions[aiIdx]}
                </span>
                <button className="text-[10px] font-semibold text-white bg-[#7C3AED] px-2.5 py-1 rounded-lg hover:bg-purple-700 transition-colors shrink-0">
                  Use Suggestion
                </button>
                <button onClick={() => setShowAI(false)} className="p-0.5 rounded hover:bg-purple-100 text-purple-400">
                  <X size={14} />
                </button>
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
                        <span className="text-[10px] text-gray-400 bg-gray-200/60 px-3 py-0.5 rounded-full">
                          {curDate}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-1`}>
                      <div
                        className={`max-w-[75%] px-3.5 py-2 text-sm whitespace-pre-wrap ${
                          isSent
                            ? 'bg-[#2563EB] text-white rounded-2xl rounded-br-sm'
                            : 'bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-sm'
                        }`}
                      >
                        {msg.content}
                        <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : ''}`}>
                          <span className={`text-[10px] ${isSent ? 'text-blue-200' : 'text-gray-400'}`}>
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
            <div className="flex gap-2 px-4 py-2 border-t border-gray-100 overflow-x-auto shrink-0">
              {quickReplies.map((r) => (
                <button
                  key={r}
                  onClick={() => setInput(r)}
                  className="text-[11px] text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full whitespace-nowrap transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>

            {/* ── AI Smart Replies ──────────────────────────────── */}
            <div className="mx-3 mb-2 rounded-xl p-3 shrink-0" style={{ background: '#F5F3FF' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#7C3AED]" />
                  <span className="text-xs font-semibold text-[#7C3AED]">AI Smart Replies</span>
                </div>
                <button
                  onClick={refreshSmartReplies}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-purple-100 transition-colors"
                  title="Refresh suggestions"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {smartReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(reply)}
                    className="w-full text-left bg-white rounded-lg p-2 border border-purple-100 hover:border-purple-400 hover:shadow-sm transition-all"
                  >
                    <p className="text-xs text-gray-700 line-clamp-2">{reply}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Message input ──────────────────────────────────── */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 bg-white shrink-0">
              <button className="p-2 rounded-lg text-gray-400 cursor-not-allowed"><Paperclip size={18} /></button>
              <button className="p-2 rounded-lg text-gray-400 cursor-not-allowed"><Image size={18} /></button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAICompose}
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-[#7C3AED] text-white hover:bg-purple-700 transition-colors shrink-0"
                title="AI Compose"
              >
                <Sparkles size={14} />
                <span className="text-xs font-semibold">AI</span>
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-9 h-9 rounded-full bg-[#2563EB] text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>

            {/* ── Encryption note ────────────────────────────────── */}
            <p className="text-[10px] text-gray-400 text-center py-1 bg-white shrink-0">
              🔒 End-to-end encrypted • Velara Secure Inbox
            </p>
          </>
        )}
      </div>
    </div>
  );
}
