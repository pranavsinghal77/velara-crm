import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import { getLeads, getReminders, getNotifications } from '../types/index';
import type { Lead, Reminder } from '../types/index';

type View = 'welcome' | 'hot-leads' | 'follow-ups' | 'summary' | 'pro';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('welcome');
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const unreadCount = getNotifications().filter((n) => !n.isRead).length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  const handleSend = () => {
    if (!input.trim()) return;
    setInput('');
    setView('pro');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  // ── Data helpers ─────────────────────────────────────────
  const hotLeads: Lead[] = getLeads().filter((l) => l.isHot);
  const todayReminders: Reminder[] = getReminders().filter(
    (r) => r.isToday && !r.isCompleted,
  );
  const allLeads = getLeads();
  const wonThisMonth = allLeads.filter((l) => {
    if (l.status !== 'Won') return false;
    const d = new Date(l.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const topLead = [...allLeads].sort((a, b) => b.aiScore - a.aiScore)[0];

  // ── Render helpers ───────────────────────────────────────
  function renderContent() {
    switch (view) {
      case 'hot-leads':
        return (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              🔥 Hot Leads ({hotLeads.length})
            </p>
            {hotLeads.map((l) => (
              <div
                key={l.id}
                className="bg-gray-50 rounded-lg p-2.5 border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    {l.name}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Score: {l.aiScore}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                    {l.source}
                  </span>
                  <span className="text-xs text-gray-500">{l.phone}</span>
                </div>
              </div>
            ))}
          </div>
        );

      case 'follow-ups':
        return (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              ⏰ Today's Follow-ups ({todayReminders.length})
            </p>
            {todayReminders.length === 0 && (
              <p className="text-sm text-gray-400">
                No follow-ups due today. Great job! 🎉
              </p>
            )}
            {todayReminders.map((r) => (
              <div
                key={r.id}
                className="bg-gray-50 rounded-lg p-2.5 border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    {r.leadName}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      r.priority === 'High'
                        ? 'bg-red-100 text-red-700'
                        : r.priority === 'Medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {r.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{r.task}</p>
              </div>
            ))}
          </div>
        );

      case 'summary':
        return (
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-900">📊 Today's Summary</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-blue-700">{allLeads.length}</p>
                <p className="text-[10px] text-blue-600">Total Leads</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-orange-600">{hotLeads.length}</p>
                <p className="text-[10px] text-orange-500">🔥 Hot Leads</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-green-700">{wonThisMonth}</p>
                <p className="text-[10px] text-green-600">✅ Won This Month</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-purple-700">
                  {todayReminders.length}
                </p>
                <p className="text-[10px] text-purple-600">⏰ Follow-ups Due</p>
              </div>
            </div>
            {topLead && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
                <p className="text-xs text-yellow-800">
                  💡 <span className="font-semibold">AI Tip:</span> Focus on{' '}
                  <span className="font-bold">{topLead.name}</span> today — highest
                  conversion probability ({topLead.aiScore}% score).
                </p>
              </div>
            )}
          </div>
        );

      case 'pro':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-3xl mb-2">🤖</p>
            <p className="text-sm text-gray-600">
              Advanced AI responses available in{' '}
              <span className="font-bold text-purple-600">Velara Pro</span>.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Try the quick actions above!
            </p>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-3xl mb-3">🙏</p>
            <p className="text-sm text-gray-700 font-medium">
              Namaste! I'm your AI sales assistant.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Ask me anything about your leads or click a quick action above.
            </p>
          </div>
        );
    }
  }

  return (
    <>
      {/* ── Chat Panel ──────────────────────────────────────── */}
      <div
        className={`fixed bottom-20 right-4 z-50 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden transition-all duration-300 ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{
            background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-white" />
            <div>
              <p className="text-sm leading-tight">
                <span className="font-bold text-white">Velara AI </span>
                <span className="font-light text-white/80">Assistant</span>
              </p>
              <p className="text-[10px] text-white/60">
                Powered by Velara Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              setView('welcome');
            }}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 shrink-0">
          <button
            onClick={() => setView('hot-leads')}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              view === 'hot-leads'
                ? 'bg-purple-100 border-purple-300 text-purple-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            🔥 Hot Leads
          </button>
          <button
            onClick={() => setView('follow-ups')}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              view === 'follow-ups'
                ? 'bg-purple-100 border-purple-300 text-purple-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            ⏰ Follow-ups
          </button>
          <button
            onClick={() => setView('summary')}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              view === 'summary'
                ? 'bg-purple-100 border-purple-300 text-purple-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            📊 Summary
          </button>
        </div>

        {/* Response Display */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
          {renderContent()}
        </div>

        {/* Text Input */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Velara AI..."
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            className="p-2 rounded-lg bg-[#7C3AED] text-white hover:bg-purple-700 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* ── Floating Button ─────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-50" title="Velara AI Assistant">
        {/* Ping animation */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-[#7C3AED] opacity-75 animate-ping" />
        )}

        <button
          onClick={() => {
            setIsOpen((v) => !v);
            if (isOpen) setView('welcome');
          }}
          className="relative w-14 h-14 rounded-full bg-[#7C3AED] text-white flex items-center justify-center shadow-lg hover:bg-purple-700 transition-colors"
        >
          {isOpen ? <X size={24} /> : <Sparkles size={24} />}
        </button>

        {/* Notification badge */}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount}
          </span>
        )}
      </div>
    </>
  );
}
