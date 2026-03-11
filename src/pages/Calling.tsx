import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Phone,
  PhoneOff,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Sparkles,
  MicOff,
  Mic,
  Pause,
  Play,
  Volume2,
  FileText,
  Download,
  StickyNote,
  X,
  Search,
  Delete,
  Star,
  ChevronRight,
  Bell,
} from 'lucide-react';
import { getLeads, getCurrentUser } from '../types/index';
import type { Lead } from '../types/index';

// ─── types ────────────────────────────────────────────────────────────────────

type CallType = 'VoIP' | 'GSM';
type CallDirection = 'outgoing' | 'incoming' | 'missed';
type HistoryFilter = 'All' | 'Incoming' | 'Outgoing' | 'Missed' | 'Recorded';

interface CallRecord {
  id: string;
  leadName: string;
  phone: string;
  source: string;
  direction: CallDirection;
  duration: string;
  callType: CallType;
  date: string;
  recorded: boolean;
  hasTranscript: boolean;
  hasNotes: boolean;
  notes?: string;
}

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_CALLS: CallRecord[] = [
  { id: 'c1',  leadName: 'Rajesh Kumar',  phone: '+91 98765 43210', source: 'JustDial',  direction: 'outgoing', duration: '5:23',   callType: 'VoIP', date: 'Today, 10:32 AM',      recorded: true,  hasTranscript: true,  hasNotes: false },
  { id: 'c2',  leadName: 'Priya Sharma',  phone: '+91 87654 32109', source: 'IndiaMART', direction: 'incoming', duration: '3:12',   callType: 'GSM',  date: 'Today, 09:15 AM',      recorded: true,  hasTranscript: false, hasNotes: false },
  { id: 'c3',  leadName: 'Amit Patel',    phone: '+91 76543 21098', source: 'Website',   direction: 'outgoing', duration: '8:45',   callType: 'VoIP', date: 'Today, 08:50 AM',      recorded: true,  hasTranscript: false, hasNotes: true,  notes: 'Interested in bulk order. Needs pricing sheet.' },
  { id: 'c4',  leadName: 'Sunita Verma',  phone: '+91 65432 10987', source: 'WhatsApp',  direction: 'missed',   duration: 'Missed', callType: 'GSM',  date: 'Yesterday, 05:40 PM',  recorded: false, hasTranscript: false, hasNotes: false },
  { id: 'c5',  leadName: 'Vikram Singh',  phone: '+91 54321 09876', source: 'Referral',  direction: 'outgoing', duration: '2:30',   callType: 'VoIP', date: 'Yesterday, 03:10 PM',  recorded: true,  hasTranscript: false, hasNotes: false },
  { id: 'c6',  leadName: 'Meera Nair',    phone: '+91 43210 98765', source: 'JustDial',  direction: 'incoming', duration: '6:15',   callType: 'GSM',  date: 'Yesterday, 01:25 PM',  recorded: true,  hasTranscript: true,  hasNotes: false },
  { id: 'c7',  leadName: 'Arjun Mehta',   phone: '+91 32109 87654', source: 'IndiaMART', direction: 'outgoing', duration: '11:20',  callType: 'VoIP', date: 'Mar 10, 11:05 AM',     recorded: true,  hasTranscript: false, hasNotes: true,  notes: 'Demo scheduled for Friday 2 PM.' },
  { id: 'c8',  leadName: 'Kavya Reddy',   phone: '+91 21098 76543', source: 'Website',   direction: 'missed',   duration: 'Missed', callType: 'GSM',  date: 'Mar 10, 09:30 AM',     recorded: false, hasTranscript: false, hasNotes: false },
  { id: 'c9',  leadName: 'Rohit Gupta',   phone: '+91 10987 65432', source: 'Website',   direction: 'incoming', duration: '4:05',   callType: 'VoIP', date: 'Mar 09, 03:15 PM',     recorded: true,  hasTranscript: false, hasNotes: false },
  { id: 'c10', leadName: 'Anita Desai',   phone: '+91 09876 54321', source: 'Referral',  direction: 'outgoing', duration: '7:33',   callType: 'GSM',  date: 'Mar 09, 01:00 PM',     recorded: true,  hasTranscript: true,  hasNotes: false },
];

const TRANSCRIPT_LINES = [
  { time: '00:00', speaker: 'You',    text: 'Namaste Rajesh ji, this is Sneha from Velara...' },
  { time: '00:08', speaker: 'Rajesh', text: 'Yes, namaste. I was expecting your call...' },
  { time: '00:15', speaker: 'You',    text: 'I wanted to discuss the enterprise package with you.' },
  { time: '00:28', speaker: 'Rajesh', text: "Yes, we've reviewed the proposal you sent last week." },
  { time: '00:45', speaker: 'You',    text: 'What are your thoughts on the pricing?' },
  { time: '01:02', speaker: 'Rajesh', text: "The pricing seems reasonable, ₹5L is within our budget." },
  { time: '01:18', speaker: 'You',    text: 'Great! Should I send a formal proposal document?' },
  { time: '01:35', speaker: 'Rajesh', text: "Yes please, send it by Friday. I'll review with the team." },
  { time: '01:50', speaker: 'You',    text: "Absolutely. I'll also include the implementation timeline." },
  { time: '02:10', speaker: 'Rajesh', text: 'Perfect. We were also looking at Salesforce but your pricing is better.' },
];

const sourceBadgeColor: Record<string, string> = {
  JustDial:  'bg-blue-100 text-blue-700',
  IndiaMART: 'bg-orange-100 text-orange-700',
  Website:   'bg-green-100 text-green-700',
  WhatsApp:  'bg-teal-100 text-teal-700',
  Referral:  'bg-purple-100 text-purple-700',
};

const DIAL_KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];
const HISTORY_TABS: HistoryFilter[] = ['All', 'Incoming', 'Outgoing', 'Missed', 'Recorded'];

// ─── timer hook ───────────────────────────────────────────────────────────────

function useTimer(running: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) { setSecs(0); return; }
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Calling() {
  const leads = useMemo(() => getLeads(), []);
  getCurrentUser();

  // dialer
  const [dialNumber, setDialNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [callType, setCallType] = useState<CallType>('VoIP');
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState<'Ringing' | 'Connected' | 'On Hold'>('Ringing');
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const timer = useTimer(callActive && callStatus === 'Connected');

  // history
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('All');
  const [callSearch, setCallSearch] = useState('');
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [playingCall, setPlayingCall] = useState<CallRecord | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // transcript panel
  const [transcriptNotes, setTranscriptNotes] = useState('Rajesh interested in enterprise plan. Needs proposal by Friday. Competition: Salesforce. Budget: ₹5L approved.');
  const [noteSaved, setNoteSaved] = useState(true);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    let list: CallRecord[] = MOCK_CALLS;
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

  function startCall() {
    if (!dialNumber) return;
    setCallActive(true);
    setCallStatus('Ringing');
    setMuted(false); setOnHold(false); setRecording(false); setSpeaker(false); setCallNotes('');
    setTimeout(() => setCallStatus('Connected'), 2000);
  }

  function endCall() {
    setCallActive(false);
    setCallStatus('Ringing');
    setActiveLead(null);
  }

  function handleHold() {
    setOnHold((h) => {
      setCallStatus(!h ? 'On Hold' : 'Connected');
      return !h;
    });
  }

  function handleNoteChange(v: string) {
    setTranscriptNotes(v);
    setNoteSaved(false);
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(() => setNoteSaved(true), 1000);
  }

  function handlePlayRecording(c: CallRecord) {
    if (playingCall?.id === c.id) {
      if (isPlaying) {
        if (playTimerRef.current) clearInterval(playTimerRef.current);
        setIsPlaying(false);
      } else {
        startPlayInterval();
      }
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      setPlayingCall(c);
      setPlayProgress(0);
      startPlayInterval();
    }
  }

  function startPlayInterval() {
    setIsPlaying(true);
    playTimerRef.current = setInterval(() => {
      setPlayProgress((p) => {
        if (p >= 100) {
          if (playTimerRef.current) clearInterval(playTimerRef.current);
          setIsPlaying(false);
          return 0;
        }
        return p + 0.5;
      });
    }, 100);
  }

  return (
    <div className="space-y-6">

      {/* ═══ SECTION 1 — HEADER ═════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Calling Center</h1>
          </div>
          <p className="text-gray-500 text-sm">VoIP & GSM calling with AI transcription & analytics</p>
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
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900 transition-colors">
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
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-gray-900">{c.value}</span>
                <span className="text-sm text-gray-500 mt-0.5">{c.label}</span>
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

          {/* SMART DIALER */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Dialer header */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-white" />
                <span className="text-white font-semibold text-sm">Smart Dialer</span>
              </div>
              <div className="flex bg-gray-700 rounded-lg p-0.5">
                {(['VoIP', 'GSM'] as CallType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCallType(t)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      callType === t ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Dialer body — normal or active call overlay */}
            {!callActive ? (
              <div className="p-4 flex flex-col gap-4">
                {/* Lead search */}
                <div className="relative">
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      placeholder="Search lead or number..."
                      className="flex-1 text-sm outline-none"
                    />
                  </div>
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                      {suggestions.map((l) => (
                        <button
                          key={l.id}
                          onMouseDown={() => handleSelectLead(l)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {l.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{l.name}</p>
                            <p className="text-xs text-gray-400">{l.phone}</p>
                          </div>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${sourceBadgeColor[l.source] ?? ''}`}>
                            {l.source}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Number display */}
                <div className="bg-gray-50 rounded-xl p-4 text-center border-2 border-gray-200 min-h-16 flex flex-col items-center justify-center gap-1">
                  {activeLead ? (
                    <>
                      <span className="text-base font-semibold text-gray-800">{activeLead.name}</span>
                      <span className="text-sm font-mono text-gray-500 tracking-wider">{dialNumber}</span>
                    </>
                  ) : (
                    <span className="text-2xl font-mono text-gray-800 tracking-wider">
                      {dialNumber || <span className="text-gray-300">—</span>}
                    </span>
                  )}
                </div>

                {/* Dial pad */}
                <div className="grid grid-cols-3 gap-2">
                  {DIAL_KEYS.map((k) => (
                    <button
                      key={k}
                      onClick={() => handleDial(k)}
                      className="aspect-square rounded-xl bg-gray-50 hover:bg-blue-50 hover:text-blue-600 font-semibold text-lg transition-colors border border-gray-100 flex items-center justify-center"
                    >
                      {k}
                    </button>
                  ))}
                </div>

                {/* Action row */}
                <div className="flex gap-2">
                  <button
                    onClick={handleBackspace}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Delete className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={startCall}
                    disabled={!dialNumber}
                    className="flex-[2] py-2 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </button>
                  <button onClick={handleClear} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors">
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            ) : (
              /* ACTIVE CALL OVERLAY */
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 flex flex-col gap-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-base">{activeLead?.name ?? searchQuery ?? dialNumber}</p>
                    <p className="text-green-100 text-xs">{dialNumber}</p>
                  </div>
                  <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">{callStatus}</span>
                </div>
                <div className="text-center">
                  <span className="text-4xl font-mono font-bold tracking-widest">{timer}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { label: 'Mute',              Icon: muted    ? MicOff : Mic, active: muted,      toggle: () => setMuted((v) => !v)      },
                    { label: onHold ? 'Resume' : 'Hold', Icon: onHold ? Play : Pause, active: onHold, toggle: handleHold                     },
                    { label: 'Record',            Icon: Phone,                   active: recording,  toggle: () => setRecording((v) => !v)  },
                    { label: 'Speaker',           Icon: Volume2,                 active: speaker,    toggle: () => setSpeaker((v) => !v)    },
                  ] as const).map((btn) => (
                    <button
                      key={btn.label}
                      onClick={btn.toggle}
                      className={`rounded-xl p-3 flex flex-col items-center gap-1 text-xs font-medium transition-colors hover:bg-white/30 ${btn.active ? 'bg-white/30' : 'bg-white/20'}`}
                    >
                      <btn.Icon className="w-5 h-5" />
                      {btn.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Type notes during call..."
                  className="w-full bg-white/10 rounded-lg p-3 text-white placeholder-white/60 text-sm outline-none resize-none border border-white/20"
                />
                <button
                  onClick={endCall}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Call
                </button>
              </div>
            )}
          </div>

          {/* QUICK CONTACTS */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900">Quick Contacts</h3>
            </div>
            {hotLeads.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No hot leads</p>
            ) : (
              hotLeads.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {l.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{l.name}</p>
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{l.aiScore}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectLead(l)}
                    className="w-7 h-7 rounded-full bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5 text-green-600" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── MIDDLE: lg:col-span-5 ──────────────────────── */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-bold text-gray-900">Call Recordings & History</h3>
              </div>
              <span className="text-xs text-gray-400">{filteredCalls.length} calls</span>
            </div>

            {/* Filter tabs */}
            <div className="px-4 pt-3">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {HISTORY_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setHistoryFilter(t)}
                    className={`flex-1 text-[11px] font-medium py-1 rounded-md transition-colors ${
                      historyFilter === t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="mx-4 mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                value={callSearch}
                onChange={(e) => setCallSearch(e.target.value)}
                placeholder="Search calls..."
                className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
              />
            </div>

            {/* Audio player */}
            {playingCall && (
              <div className="mx-4 mt-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{playingCall.leadName}</p>
                    <p className="text-xs text-gray-400">{playingCall.duration}</p>
                  </div>
                  <button
                    onClick={() => { setPlayingCall(null); setIsPlaying(false); if (playTimerRef.current) clearInterval(playTimerRef.current); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePlayRecording(playingCall)}
                    className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 cursor-pointer">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${playProgress}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                    {String(Math.floor((playProgress / 100) * 5)).padStart(2, '0')}:
                    {String(Math.floor(((playProgress / 100) * 5 * 60) % 60)).padStart(2, '0')} / {playingCall.duration}
                  </span>
                </div>
              </div>
            )}

            {/* Call list */}
            <div className="mt-3 max-h-[520px] overflow-y-auto">
              {filteredCalls.map((c) => {
                const isSelected = selectedCall?.id === c.id;
                const DirIcon = c.direction === 'incoming' ? PhoneIncoming : c.direction === 'outgoing' ? PhoneOutgoing : PhoneMissed;
                const dirBg    = c.direction === 'incoming' ? 'bg-green-100' : c.direction === 'outgoing' ? 'bg-blue-100' : 'bg-red-100';
                const dirColor = c.direction === 'incoming' ? 'text-green-600' : c.direction === 'outgoing' ? 'text-blue-600' : 'text-red-600';
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCall(isSelected ? null : c)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors text-left ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-full ${dirBg} flex items-center justify-center shrink-0`}>
                      <DirIcon className={`w-4 h-4 ${dirColor}`} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{c.leadName}</span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${c.callType === 'VoIP' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {c.callType}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{c.date}</span>
                      <span className={`text-xs font-medium ${c.direction === 'missed' ? 'text-red-500' : 'text-green-600'}`}>
                        {c.duration}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.hasTranscript && (
                        <span className="p-1.5 bg-purple-100 rounded-lg">
                          <FileText className="w-4 h-4 text-purple-600" />
                        </span>
                      )}
                      {c.recorded && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePlayRecording(c); }}
                          className="p-1.5 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          <Play className="w-4 h-4 text-blue-600" />
                        </button>
                      )}
                      {c.hasNotes && (
                        <span className="p-1.5 bg-amber-100 rounded-lg">
                          <StickyNote className="w-4 h-4 text-amber-600" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── RIGHT: lg:col-span-4 ───────────────────────── */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">AI Call Intelligence</span>
              </div>
              <p className="text-purple-200 text-xs mt-0.5">Powered by Velara Speech AI</p>
            </div>

            {/* Empty state */}
            {!selectedCall ? (
              <div className="flex flex-col items-center justify-center p-10 gap-4 text-center">
                <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">AI Transcript Ready</h3>
                  <p className="text-gray-500 text-sm mt-1">Select any recorded call to view AI transcription, sentiment analysis and key insights</p>
                </div>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[680px]">
                {/* Call info bar */}
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{selectedCall.leadName}</p>
                    <p className="text-xs text-gray-400">{selectedCall.date} · {selectedCall.duration}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Download className="w-4 h-4" /></button>
                    <button onClick={() => setSelectedCall(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* A: AI Summary */}
                <div className="mx-4 mb-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-purple-800">📋 AI Summary</span>
                    <span className="text-[10px] font-bold bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">94% confidence</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Rajesh Kumar expressed strong interest in Enterprise package. Budget ₹5L confirmed. Proposal requested by Friday. Follow-up scheduled for Monday.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1.5 bg-purple-200 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 rounded-full" style={{ width: '94%' }} />
                    </div>
                    <span className="text-[10px] font-bold text-purple-700">94%</span>
                  </div>
                </div>

                {/* B: Sentiment */}
                <div className="mx-4 mb-4 bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-gray-700">Call Sentiment</p>
                    <span className="text-sm">😊</span>
                  </div>
                  <div className="space-y-2">
                    {([
                      { label: 'Positive', pct: 68, color: 'bg-green-500' },
                      { label: 'Neutral',  pct: 24, color: 'bg-gray-400'  },
                      { label: 'Negative', pct: 8,  color: 'bg-red-500'   },
                    ]).map((s) => (
                      <div key={s.label} className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-500 w-14">{s.label}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-gray-600 w-8 text-right">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                  <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">😊 Positive Overall</span>
                </div>

                {/* C: Key Points */}
                <div className="mx-4 mb-4 bg-white rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-700 mb-2">Key Points</p>
                  <ul className="space-y-1">
                    {[
                      '✅ Budget confirmed: ₹5L',
                      '✅ Decision maker on call',
                      '📅 Proposal requested by Friday',
                      '🔄 Follow-up needed in 2 days',
                      '⚠️ Competitor mentioned: Salesforce',
                    ].map((pt) => (
                      <li key={pt} className="text-[12px] text-gray-700">{pt}</li>
                    ))}
                  </ul>
                </div>

                {/* D: Full Transcript */}
                {selectedCall.hasTranscript && (
                  <div className="mx-4 mb-4">
                    <p className="text-xs font-bold text-gray-700 mb-2">Full Transcript</p>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 bg-gray-50 rounded-xl p-3 border border-gray-100">
                      {TRANSCRIPT_LINES.map((line) => (
                        <div key={line.time} className="text-[11px]">
                          <span className="text-gray-400 mr-1.5">[{line.time}]</span>
                          <span className={`font-semibold mr-1.5 ${line.speaker === 'You' ? 'text-blue-600' : 'text-gray-700'}`}>
                            {line.speaker}:
                          </span>
                          <span className="text-gray-700">"{line.text}"</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* E: Notes */}
                <div className="mx-4 mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-gray-700">Notes from this call</p>
                    <span className={`text-[10px] font-semibold ${noteSaved ? 'text-green-600' : 'text-gray-400'}`}>
                      {noteSaved ? 'Saved ✓' : 'Saving...'}
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={transcriptNotes}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    className="w-full text-xs border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* F: AI Recommended Next Action */}
                <div className="mx-4 mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-green-800 mb-1">🤖 AI Recommended Next Action</p>
                  <p className="text-xs text-green-700 leading-relaxed mb-3">
                    Send formal proposal to rajesh.kumar@gmail.com by Friday. Schedule follow-up call for Monday 10 AM.
                  </p>
                  <div className="flex gap-2">
                    <button className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors flex items-center justify-center gap-1">
                      <Bell className="w-3 h-3" />
                      Create Reminder
                    </button>
                    <button className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      Send Email
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
