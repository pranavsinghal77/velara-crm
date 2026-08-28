import { useState, useRef } from 'react';
import { Search, PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, Pause, FileText, StickyNote, X, Clock } from 'lucide-react';
import { HISTORY_TABS } from './types';
import type { CallRecord, HistoryFilter } from './types';

interface CallHistoryProps {
  filteredCalls: CallRecord[];
  selectedCall: CallRecord | null;
  setSelectedCall: (c: CallRecord | null) => void;
  historyFilter: HistoryFilter;
  setHistoryFilter: (f: HistoryFilter) => void;
  callSearch: string;
  setCallSearch: (s: string) => void;
}

export default function CallHistory({
  filteredCalls,
  selectedCall,
  setSelectedCall,
  historyFilter,
  setHistoryFilter,
  callSearch,
  setCallSearch
}: CallHistoryProps) {
  const [playingCall, setPlayingCall] = useState<CallRecord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  return (
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
              onClick={() => {
                setPlayingCall(null);
                setIsPlaying(false);
                if (playTimerRef.current) clearInterval(playTimerRef.current);
              }}
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
  );
}
