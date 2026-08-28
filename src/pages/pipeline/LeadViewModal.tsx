import React, { useState } from 'react';
import {
  X,
  Flame,
  Phone,
  MessageSquare,
  Receipt,
  Clock,
  Plus,
  Send,
  Sparkles,
  Building,
  MapPin,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import type { Lead } from '../../types/models';
import { sourceBadge, statusBadge, scoreColor } from './types';

interface LeadViewModalProps {
  viewLead: Lead | null;
  setViewId: (id: string | null) => void;
  openEdit: (l: Lead) => void;
}

interface TimelineEvent {
  id: string;
  type: 'call' | 'whatsapp' | 'quote' | 'status' | 'note';
  title: string;
  desc: string;
  timestamp: string;
  author: string;
}

export default function LeadViewModal({ viewLead, setViewId, openEdit }: LeadViewModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('timeline');
  const [newNote, setNewNote] = useState('');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([
    {
      id: 'evt-1',
      type: 'quote',
      title: 'GST Proforma Quotation Generated',
      desc: 'Proposal QT-2026-9214 sent with 50-user Enterprise Plan & 20% annual discount.',
      timestamp: '2 hours ago',
      author: 'Pranav Singhal',
    },
    {
      id: 'evt-2',
      type: 'call',
      title: 'Outbound VoIP Call Connected (4m 32s)',
      desc: 'Client requested demo of TallyPrime 2-way sync connector and GST input tax credit terms.',
      timestamp: 'Yesterday at 3:45 PM',
      author: 'Sneha Kapoor',
    },
    {
      id: 'evt-3',
      type: 'whatsapp',
      title: 'WhatsApp Brochure Delivered',
      desc: 'Shared Velara CRM feature overview & ROI calculator on official WhatsApp channel.',
      timestamp: '3 days ago',
      author: 'System Bot',
    },
    {
      id: 'evt-4',
      type: 'status',
      title: 'Lead Stage Advanced',
      desc: 'Progressed from "New Inquiries" to "Qualified" via automated AI scoring (>75).',
      timestamp: '5 days ago',
      author: 'AI Deal Assistant',
    },
  ]);

  if (!viewLead) return null;

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    const item: TimelineEvent = {
      id: `evt-${Date.now()}`,
      type: 'note',
      title: 'Rep Activity Note',
      desc: newNote.trim(),
      timestamp: 'Just now',
      author: 'You (Active Rep)',
    };
    setTimeline([item, ...timeline]);
    setNewNote('');
  }

  function getEventIcon(type: TimelineEvent['type']) {
    switch (type) {
      case 'call':
        return { icon: Phone, bg: 'bg-blue-100 text-blue-700' };
      case 'whatsapp':
        return { icon: MessageSquare, bg: 'bg-emerald-100 text-emerald-700' };
      case 'quote':
        return { icon: Receipt, bg: 'bg-teal-100 text-teal-700' };
      case 'status':
        return { icon: Sparkles, bg: 'bg-purple-100 text-purple-700' };
      case 'note':
      default:
        return { icon: Clock, bg: 'bg-amber-100 text-amber-700' };
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{viewLead.name}</h2>
                {viewLead.isHot && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    <Flame size={11} /> HOT LEAD
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                {viewLead.company && <span className="font-semibold text-gray-700">{viewLead.company}</span>}
                {viewLead.city && <span>• {viewLead.city}</span>}
                <span>• Source: {viewLead.source}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 text-xs font-bold ${scoreColor(
                viewLead.aiScore
              )}`}
              title="AI Score"
            >
              ⚡ {viewLead.aiScore}
            </span>
            <button onClick={() => setViewId(null)} className="p-1 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-6 bg-white">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 text-xs font-bold border-b-2 mr-6 transition-all flex items-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Clock size={14} />
            Omnichannel Activity Timeline ({timeline.length})
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Building size={14} />
            Lead Details & AI Score Breakdown
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'timeline' ? (
            <div className="space-y-4">
              {/* Quick Log Note / Activity */}
              <form onSubmit={handleAddNote} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <label className="text-[11px] font-bold text-slate-700 block">Log an Interaction Note:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="e.g. Call completed, client requested sample GST invoice..."
                    className="flex-1 text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Plus size={13} /> Log Note
                  </button>
                </div>
              </form>

              {/* Vertical Timeline */}
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {timeline.map((evt) => {
                  const { icon: Icon, bg } = getEventIcon(evt.type);
                  return (
                    <div key={evt.id} className="relative group">
                      {/* Timeline node icon */}
                      <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ${bg} ring-4 ring-white shadow-xs`}>
                        <Icon size={10} />
                      </div>

                      {/* Content Card */}
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-sm transition-all">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-gray-900">{evt.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{evt.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{evt.desc}</p>
                        <div className="mt-2 text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                          <span>Logged by {evt.author}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* DETAILS TAB */
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-gray-400 text-[11px]">Phone Number</p>
                  <p className="font-semibold text-gray-800 font-mono mt-0.5">{viewLead.phone}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px]">Email Address</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{viewLead.email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px]">Company</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{viewLead.company ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px]">Designation</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{viewLead.designation ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px]">City / Location</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{viewLead.city ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px]">Budget Size</p>
                  <p className="font-bold text-slate-900 font-mono mt-0.5">{viewLead.budget ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px] mb-1">Lead Source</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sourceBadge[viewLead.source]}`}>
                    {viewLead.source}
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px] mb-1">Deal Stage</p>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      statusBadge[viewLead.status].bg
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge[viewLead.status].dot}`} />
                    {viewLead.status}
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px]">Assigned Sales Rep</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{viewLead.assignedTo || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px]">Created At</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{viewLead.createdAt}</p>
                </div>
              </div>

              {/* AI Score Breakdown */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-xs font-bold text-gray-800 mb-2.5 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-blue-600" />
                  AI Conversion Score Breakdown (Total: {viewLead.aiScore}/100)
                </p>
                {(['sourceQuality', 'recency', 'profileCompleteness'] as const).map((k) => (
                  <div key={k} className="mb-2 last:mb-0">
                    <div className="flex items-center justify-between text-[11px] mb-0.5 font-medium">
                      <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-bold text-gray-700">{viewLead.aiScoreBreakdown[k]} pts</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                        style={{ width: `${Math.min(100, (viewLead.aiScoreBreakdown[k] / 35) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {viewLead.notes && (
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-1">Lead Notes</p>
                  <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3 leading-relaxed">
                    {viewLead.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center px-6 py-3.5 border-t border-gray-100 bg-slate-50/50">
          <span className="text-[11px] text-gray-400">ID: {viewLead.id}</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const l = viewLead;
                setViewId(null);
                openEdit(l);
              }}
              className="px-4 py-2 text-xs font-bold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Edit Lead Details
            </button>
            <button
              onClick={() => setViewId(null)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
