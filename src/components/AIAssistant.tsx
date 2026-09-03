import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Flame, Clock, BarChart3, Copy, Check, RotateCcw } from 'lucide-react';
import { ApiError, api } from '../lib/api';
import { useCrmStore } from '../store/useCrmStore';
import type { Lead, Reminder } from '../types/models';

type View = 'chat' | 'hot-leads' | 'follow-ups' | 'summary';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const PROMPT_SUGGESTIONS = [
  '⚡ Which hot leads should I call first today?',
  '📊 Summarize pipeline value & closing velocity',
  '💰 Draft a WhatsApp follow-up with 18% GST quote',
  '🛡️ Show high-intent accounts at risk of churn',
];

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('chat');
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      text: 'Namaste! I am Velara AI, your enterprise sales copilot. How can I help accelerate your pipeline today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const leads = useCrmStore((s) => s.leads);
  const reminders = useCrmStore((s) => s.reminders);
  const notifications = useCrmStore((s) => s.notifications);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatLoading, view]);

  useEffect(() => {
    const openAssistant = () => setIsOpen(true);
    window.addEventListener('velara:assistant-open', openAssistant as EventListener);
    return () => {
      window.removeEventListener('velara:assistant-open', openAssistant as EventListener);
    };
  }, []);

  const hotLeads: Lead[] = leads.filter((l: Lead) => l.isHot);
  const todayReminders: Reminder[] = reminders.filter((r: Reminder) => r.isToday && !r.isCompleted);
  const wonThisMonth = leads.filter((l: Lead) => {
    if (l.status !== 'Won') return false;
    const d = new Date(l.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const topLead = [...leads].sort((a, b) => b.aiScore - a.aiScore)[0];

  const handleSend = async (customQuery?: string) => {
    const question = (customQuery || input).trim();
    if (!question || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setView('chat');
    setIsChatLoading(true);

    const reply = (text: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    };

    try {
      // The pipeline snapshot is assembled server-side from this org's own
      // records. Sending it from here meant the model was reasoning over
      // whatever the browser chose to claim.
      const data = await api.post<{ response: string }>('/ai/chat', {
        query: question,
        history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
      });
      reply(data.response);
    } catch (err) {
      // Say what actually went wrong instead of presenting a canned
      // "pipeline summary" as if the model had produced it.
      if (err instanceof ApiError) {
        reply(
          err.status === 503
            ? 'AI is not available right now, so I cannot answer that. Your CRM data is unaffected.'
            : err.status === 429
              ? 'I am handling too many requests at the moment. Try again in a minute.'
              : err.isOffline
                ? 'I cannot reach the server. Check your connection and try again.'
                : err.message
        );
      } else {
        reply('Something went wrong answering that. Please try again.');
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        text: 'Chat history cleared. How can I help you with your deals today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <>
      {/* ── Chat Panel ──────────────────────────────────────── */}
      <div
        className={`fixed bottom-20 right-5 z-50 w-96 h-[540px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
            : 'opacity-0 translate-y-6 pointer-events-none scale-95'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 px-4 py-3.5 flex items-center justify-between text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-md">
              <Sparkles size={16} className="text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold tracking-tight">Velara AI</p>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-purple-500/30 text-purple-300 rounded border border-purple-400/30">
                  v2.5 Flash
                </span>
              </div>
              <p className="text-[10px] text-slate-300">Enterprise Sales & Pipeline Copilot</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              title="Reset Chat"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Quick View Navigation Tabs */}
        <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <button
            onClick={() => setView('chat')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              view === 'chat' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💬 Chat
          </button>
          <button
            onClick={() => setView('hot-leads')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              view === 'hot-leads' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame size={12} className="text-orange-500" /> Hot ({hotLeads.length})
          </button>
          <button
            onClick={() => setView('follow-ups')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              view === 'follow-ups' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={12} className="text-blue-500" /> Due ({todayReminders.length})
          </button>
          <button
            onClick={() => setView('summary')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              view === 'summary' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 size={12} className="text-emerald-500" /> KPI
          </button>
        </div>

        {/* Content Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/50">
          {view === 'chat' && (
            <>
              {/* Message List */}
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                      m.role === 'user'
                        ? 'bg-purple-600 text-white font-medium rounded-br-xs'
                        : 'bg-white border border-slate-200/80 text-slate-800 font-normal rounded-bl-xs'
                    }`}
                  >
                    {m.role === 'assistant' && (
                      <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-purple-700 flex items-center gap-1">
                          <Sparkles size={11} /> Velara Copilot
                        </span>
                        <button
                          onClick={() => handleCopy(m.id, m.text)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                          title="Copy Answer"
                        >
                          {copiedId === m.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        </button>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <span
                      className={`block text-[9px] mt-1 ${
                        m.role === 'user' ? 'text-purple-200 text-right' : 'text-slate-400'
                      }`}
                    >
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              ))}

              {isChatLoading && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 w-fit text-xs text-purple-700 shadow-2xs">
                  <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  <span className="font-semibold animate-pulse">Gemini AI analyzing CRM pipeline...</span>
                </div>
              )}

              {/* Prompt Suggestions */}
              {messages.length <= 3 && !isChatLoading && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggested Prompts:</p>
                  <div className="flex flex-col gap-1.5">
                    {PROMPT_SUGGESTIONS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(p)}
                        className="text-left text-xs bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-200 rounded-xl px-3 py-2 text-slate-700 hover:text-purple-700 font-medium transition-all shadow-2xs"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {view === 'hot-leads' && (
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">🔥 High Intent Deals ({hotLeads.length})</p>
              {hotLeads.map((l) => (
                <div key={l.id} className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{l.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ⚡ {l.aiScore} Score
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {l.company || 'Individual'} • Budget: {l.budget || '₹2.5L'} • {l.source}
                  </p>
                  <button
                    onClick={() => handleSend(`What is the optimal closing strategy for ${l.name}?`)}
                    className="w-full mt-1 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-[11px] font-bold transition-colors"
                  >
                    Ask AI Strategy for {l.name.split(' ')[0]} →
                  </button>
                </div>
              ))}
            </div>
          )}

          {view === 'follow-ups' && (
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">⏰ Today's Action Reminders ({todayReminders.length})</p>
              {todayReminders.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  🎉 All clear! No pending follow-ups due today.
                </div>
              ) : (
                todayReminders.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{r.leadName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                        {r.priority} Priority
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">{r.task}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {view === 'summary' && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">📊 Pipeline Intelligence Snapshot</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center shadow-2xs">
                  <p className="text-lg font-bold text-slate-900 font-mono">{leads.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Leads</p>
                </div>
                <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center shadow-2xs">
                  <p className="text-lg font-bold text-orange-600 font-mono">{hotLeads.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">🔥 Hot Deals</p>
                </div>
                <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center shadow-2xs">
                  <p className="text-lg font-bold text-emerald-600 font-mono">{wonThisMonth}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Won This Month</p>
                </div>
                <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center shadow-2xs">
                  <p className="text-lg font-bold text-purple-600 font-mono">{todayReminders.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Due Today</p>
                </div>
              </div>

              {topLead && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-3 text-xs text-purple-900 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <Sparkles size={13} className="text-purple-600" /> AI Priority Recommendation:
                  </p>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    Prioritize <strong>{topLead.name}</strong> ({topLead.company || 'Enterprise'}) with a high{' '}
                    <strong>{topLead.aiScore} AI score</strong>. Send a 18% GST proposal to secure closing.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Velara AI about leads, deals, quotes..."
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
            />
            <button
              type="submit"
              disabled={isChatLoading || !input.trim()}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white transition-colors shadow-2xs"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* ── Floating Launcher Trigger ────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-50">
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-purple-600 opacity-75 animate-ping" />
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-13 h-13 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-xl hover:scale-105 transition-all"
        >
          {isOpen ? <X size={22} /> : <Sparkles size={22} className="animate-pulse" />}
        </button>

        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full shadow-md">
            {unreadCount}
          </span>
        )}
      </div>
    </>
  );
}
