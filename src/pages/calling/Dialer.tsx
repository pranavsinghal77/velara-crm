import { useState, useEffect, useRef } from 'react';
import { Phone, Search, Delete, X, MicOff, Mic, Play, Pause, Volume2, PhoneOff } from 'lucide-react';
import type { Lead } from '../../types/models';
import { sourceBadgeColor, DIAL_KEYS } from './types';
import type { CallType } from './types';

interface DialerProps {
  callType: CallType;
  setCallType: (t: CallType) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  showSuggestions: boolean;
  setShowSuggestions: (s: boolean) => void;
  suggestions: Lead[];
  handleSelectLead: (l: Lead) => void;
  dialNumber: string;
  activeLead: Lead | null;
  handleDial: (k: string) => void;
  handleBackspace: () => void;
  handleClear: () => void;
}

export default function Dialer({
  callType,
  setCallType,
  searchQuery,
  setSearchQuery,
  showSuggestions,
  setShowSuggestions,
  suggestions,
  handleSelectLead,
  dialNumber,
  activeLead,
  handleDial,
  handleBackspace,
  handleClear
}: DialerProps) {
  // Call State
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('Ringing');
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [callNotes, setCallNotes] = useState('');

  // Timer
  const [callTimer, setCallTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (callStatus === 'Connected' && callActive && !onHold) {
      timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus, callActive, onHold]);

  function reset() {
    setCallTimer(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const timerText = `${String(Math.floor(callTimer / 60)).padStart(2, '0')}:${String(callTimer % 60).padStart(2, '0')}`;

  function startCall() {
    if (!dialNumber) return;
    reset();
    setCallActive(true);
    setCallStatus('Ringing');
    setMuted(false); setOnHold(false); setRecording(false); setSpeaker(false); setCallNotes('');
    setTimeout(() => setCallStatus('Connected'), 2000);
  }

  function endCall() {
    reset();
    setCallActive(false);
    setCallStatus('Ringing');
    // We let Calling.tsx reset activeLead if needed, or we just keep it
    handleClear();
  }

  function handleHold() {
    setOnHold((h) => {
      setCallStatus(!h ? 'On Hold' : 'Connected');
      return !h;
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Dialer header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-white" />
          <span className="text-white font-semibold text-sm">Smart Dialer</span>
        </div>
        <div className="flex bg-slate-700 rounded-lg p-0.5">
          {(['VoIP', 'GSM'] as CallType[]).map((t) => (
            <button
              key={t}
              onClick={() => setCallType(t)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                callType === t ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
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
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
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
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                {suggestions.map((l) => (
                  <button
                    key={l.id}
                    onMouseDown={() => handleSelectLead(l)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {l.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{l.name}</p>
                      <p className="text-xs text-slate-400">{l.phone}</p>
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
          <div className="bg-slate-50 rounded-xl p-4 text-center border-2 border-slate-200 min-h-16 flex flex-col items-center justify-center gap-1">
            {activeLead ? (
              <>
                <span className="text-base font-semibold text-slate-800">{activeLead.name}</span>
                <span className="text-sm font-mono text-slate-500 tracking-wider">{dialNumber}</span>
              </>
            ) : (
              <span className="text-2xl font-mono text-slate-800 tracking-wider">
                {dialNumber || <span className="text-slate-300">—</span>}
              </span>
            )}
          </div>

          {/* Dial pad */}
          <div className="grid grid-cols-3 gap-2">
            {DIAL_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => handleDial(k)}
                className="aspect-square rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 font-semibold text-lg transition-colors border border-slate-100 flex items-center justify-center"
              >
                {k}
              </button>
            ))}
          </div>

          {/* Action row */}
          <div className="flex gap-2">
            <button
              onClick={handleBackspace}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
            >
              <Delete className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={startCall}
              disabled={!dialNumber}
              className="flex-[2] py-2 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Phone className="w-4 h-4" />
              Call
            </button>
            <button onClick={handleClear} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-slate-600" />
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
            <span className="text-4xl font-mono font-bold tracking-widest">{timerText}</span>
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
  );
}
