import { useState, useMemo } from 'react';
import { Phone, PhoneCall, Clock, Sparkles, Download } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import type { Lead } from '../types/models';

import Dialer from './calling/Dialer';
import QuickContacts from './calling/QuickContacts';
import CallHistory from './calling/CallHistory';
import CallIntelligence from './calling/CallIntelligence';
import { MOCK_CALLS } from './calling/types';
import type { CallType, CallRecord, HistoryFilter } from './calling/types';

export default function Calling() {
  const leads = useCrmStore((s) => s.leads);
  const [notice, setNotice] = useState('');

  const [callType, setCallType] = useState<CallType>('VoIP');
  const [dialNumber, setDialNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('All');
  const [callSearch, setCallSearch] = useState('');

  const suggestions = useMemo(() =>
    searchQuery.length > 0
      ? leads.filter((l) =>
          l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.phone.includes(searchQuery)
        ).slice(0, 5)
      : [],
    [searchQuery, leads],
  );

  const hotLeads = useMemo(() => leads.filter((l) => l.isHot).slice(0, 4), [leads]);

  const filteredCalls = useMemo(() => {
    let list = MOCK_CALLS;
    switch (historyFilter) {
      case 'Incoming': list = MOCK_CALLS.filter((c) => c.direction === 'incoming'); break;
      case 'Outgoing': list = MOCK_CALLS.filter((c) => c.direction === 'outgoing'); break;
      case 'Missed':   list = MOCK_CALLS.filter((c) => c.direction === 'missed');   break;
      case 'Recorded': list = MOCK_CALLS.filter((c) => c.recorded);                break;
    }
    if (callSearch.trim()) {
      const q = callSearch.toLowerCase();
      list = list.filter((c) => c.leadName.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return list;
  }, [historyFilter, callSearch]);

  function handleDial(key: string) { setDialNumber((d) => d + key); }
  function handleBackspace() { setDialNumber((d) => d.slice(0, -1)); }
  function handleClear() { setDialNumber(''); setSearchQuery(''); setActiveLead(null); }

  function handleSelectLead(l: Lead) {
    setDialNumber(l.phone);
    setSearchQuery(l.name);
    setActiveLead(l);
    setShowSuggestions(false);
  }

  function downloadTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleExportLogs() {
    const lines = [
      'Velara Call Logs Export',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      ...filteredCalls.map((c) => `${c.date} | ${c.leadName} | ${c.phone} | ${c.direction.toUpperCase()} | ${c.duration} | ${c.callType}`),
    ];
    downloadTextFile('velara-call-logs.txt', lines.join('\n'));
    setNotice(`Exported ${filteredCalls.length} call logs.`);
    setTimeout(() => setNotice(''), 3000);
  }

  return (
    <div className="page-stack relative">
      {notice && (
        <div className="absolute top-0 right-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 flex items-center justify-between gap-4 z-50">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="hover:text-blue-900">Dismiss</button>
        </div>
      )}

      {/* ═══ SECTION 1 — HEADER ═════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Calling Center</h1>
          </div>
          <p className="text-slate-500 text-sm">VoIP & GSM calling with AI transcription & analytics</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-700 text-sm font-medium">VoIP Ready</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span className="text-blue-700 text-sm font-medium">GSM Gateway</span>
          </div>
          <button onClick={handleExportLogs} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-900 transition-colors">
            <Download className="w-4 h-4" />
            Export Logs
          </button>
        </div>
      </div>

      {/* ═══ SECTION 2 — STATS ROW ══════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: 'Total Calls Today', value: '24',  Icon: Phone,     bg: 'bg-blue-50',   ic: 'text-blue-600',   sub: '+3 vs yesterday' },
          { label: 'Avg Duration',       value: '4:32', Icon: Clock,     bg: 'bg-green-50',  ic: 'text-green-600',  sub: 'per call' },
          { label: 'Answer Rate',        value: '78%',  Icon: PhoneCall, bg: 'bg-amber-50',  ic: 'text-amber-600',  sub: '18 of 24 answered' },
          { label: 'AI Transcribed',     value: '22',   Icon: Sparkles,  bg: 'bg-purple-50', ic: 'text-purple-600', sub: '91% success rate' },
        ]).map((c) => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-slate-900">{c.value}</span>
                <span className="text-sm text-slate-500 mt-0.5">{c.label}</span>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.bg}`}>
                <c.Icon className={`w-5 h-5 ${c.ic}`} />
              </div>
            </div>
            <span className="text-xs text-green-600">{c.sub}</span>
          </div>
        ))}
      </div>

      {/* ═══ SECTION 3 — THREE COLUMN GRID ═════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── LEFT: lg:col-span-3 ────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Dialer
            callType={callType}
            setCallType={setCallType}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
            suggestions={suggestions}
            handleSelectLead={handleSelectLead}
            dialNumber={dialNumber}
            activeLead={activeLead}
            handleDial={handleDial}
            handleBackspace={handleBackspace}
            handleClear={handleClear}
          />
          <QuickContacts hotLeads={hotLeads} onSelectLead={handleSelectLead} />
        </div>

        {/* ─── MIDDLE: lg:col-span-5 ──────────────────────── */}
        <div className="lg:col-span-5">
          <CallHistory
            filteredCalls={filteredCalls}
            selectedCall={selectedCall}
            setSelectedCall={setSelectedCall}
            historyFilter={historyFilter}
            setHistoryFilter={setHistoryFilter}
            callSearch={callSearch}
            setCallSearch={setCallSearch}
          />
        </div>

        {/* ─── RIGHT: lg:col-span-4 ───────────────────────── */}
        <div className="lg:col-span-4">
          <CallIntelligence
            selectedCall={selectedCall}
            setSelectedCall={setSelectedCall}
            leads={leads}
          />
        </div>
      </div>
    </div>
  );
}
