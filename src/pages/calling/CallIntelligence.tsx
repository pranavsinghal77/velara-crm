import { useCrmStore } from '../../store/useCrmStore';
import { useState, useRef } from 'react';
import { Sparkles, Download, X, Bell, ChevronRight } from 'lucide-react';

import type { Lead } from '../../types/models';
import { TRANSCRIPT_LINES } from './types';
import type { CallRecord } from './types';

interface CallIntelligenceProps {
  selectedCall: CallRecord | null;
  setSelectedCall: (c: CallRecord | null) => void;
  leads: Lead[];
}

export default function CallIntelligence({ selectedCall, setSelectedCall, leads }: CallIntelligenceProps) {
  const [transcriptNotes, setTranscriptNotes] = useState('Rajesh interested in enterprise plan. Needs proposal by Friday. Competition: Salesforce. Budget: ₹5L approved.');
  const [noteSaved, setNoteSaved] = useState(true);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addReminder = useCrmStore((s) => s.addReminder);
  const [notice, setNotice] = useState('');

  function handleNoteChange(v: string) {
    setTranscriptNotes(v);
    setNoteSaved(false);
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(() => setNoteSaved(true), 1000);
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

  function handleDownloadTranscript(call: CallRecord) {
    const transcriptBody = call.hasTranscript
      ? TRANSCRIPT_LINES.map((line) => `[${line.time}] ${line.speaker}: ${line.text}`).join('\n')
      : 'No full transcript was available for this call.\nAI summary and notes are still stored.';
    downloadTextFile(`${call.leadName.replace(/\s+/g, '_')}_call_transcript.txt`, transcriptBody);
    setNotice(`Transcript downloaded for ${call.leadName}.`);
    setTimeout(() => setNotice(''), 3000);
  }

  function handleCreateReminderFromCall() {
    if (!selectedCall) return;
    const matchedLead = leads.find((lead) => lead.name === selectedCall.leadName);
    addReminder({
      id: `rem_${Date.now()}`,
      leadId: matchedLead?.id ?? selectedCall.id,
      leadName: selectedCall.leadName,
      task: `Follow up on call with ${selectedCall.leadName}`,
      dueDate: new Date().toISOString().slice(0, 10),
      dueTime: '10:00',
      isToday: true,
      isTomorrow: false,
      isCompleted: false,
      priority: 'High',
      type: 'AI-Generated',
    });
    setNotice(`Reminder created for ${selectedCall.leadName}.`);
    setTimeout(() => setNotice(''), 3000);
  }

  function handleSendEmailFromCall() {
    if (!selectedCall) return;
    const lead = leads.find((l) => l.name === selectedCall.leadName);
    if (lead?.email) {
      window.open(`mailto:${lead.email}?subject=Proposal Follow-up&body=Hi ${lead.name},%0D%0A%0D%0AAs discussed on call, sharing next steps.%0D%0A%0D%0ARegards,%0D%0AVelara Team`);
      setNotice(`Opened email draft for ${lead.name}.`);
    } else {
      setNotice('No lead email found for this contact.');
    }
    setTimeout(() => setNotice(''), 3000);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
      {notice && (
        <div className="absolute top-2 left-2 right-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-2 rounded-lg z-10 flex justify-between">
          {notice}
          <button onClick={() => setNotice('')}><X className="w-3 h-3" /></button>
        </div>
      )}
      
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
              <button onClick={() => handleDownloadTranscript(selectedCall)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Download className="w-4 h-4" /></button>
              <button onClick={() => setSelectedCall(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
          </div>

          {/* AI Summary */}
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

          {/* Sentiment */}
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

          {/* Key Points */}
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

          {/* Full Transcript */}
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

          {/* Notes */}
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

          {/* AI Recommended Next Action */}
          <div className="mx-4 mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-bold text-green-800 mb-1">🤖 AI Recommended Next Action</p>
            <p className="text-xs text-green-700 leading-relaxed mb-3">
              Send formal proposal to rajesh.kumar@gmail.com by Friday. Schedule follow-up call for Monday 10 AM.
            </p>
            <div className="flex gap-2">
              <button onClick={handleCreateReminderFromCall} className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors flex items-center justify-center gap-1">
                <Bell className="w-3 h-3" />
                Create Reminder
              </button>
              <button onClick={handleSendEmailFromCall} className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1">
                <ChevronRight className="w-3 h-3" />
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
