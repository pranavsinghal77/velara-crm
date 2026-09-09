import { Search } from 'lucide-react';
import { CATEGORIES } from './types';
import type { DocCategory } from './types';
import type { Lead } from '../../types/models';

interface DocSidebarProps {
  activeCategory: DocCategory;
  setActiveCategory: (c: DocCategory) => void;
  clientSearch: string;
  setClientSearch: (s: string) => void;
  visibleClientDocs: { leadId: string; name: string; count: number }[];
  visibleLeads: Lead[];
  selectedClientId: string;
  handleViewLeadDocs: (id: string, name: string) => void;
}

export default function DocSidebar({
  activeCategory,
  setActiveCategory,
  clientSearch,
  setClientSearch,
  visibleClientDocs,
  visibleLeads,
  selectedClientId,
  handleViewLeadDocs
}: DocSidebarProps) {
  return (
    <div className="space-y-4 min-w-0">
      {/* Categories */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Categories</h3>
        <div className="space-y-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              onClick={() => setActiveCategory(c.label)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                activeCategory === c.label
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{c.emoji} {c.label}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeCategory === c.label ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {c.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Clients with docs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Clients with Documents</h3>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Search client profile..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          {visibleClientDocs.map((c) => (
            <button
              key={c.leadId}
              onClick={() => handleViewLeadDocs(c.leadId, c.name)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                selectedClientId === c.leadId ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {c.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <span className="flex-1 text-sm font-medium text-slate-800 truncate">{c.name}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
                {c.count} docs
              </span>
            </button>
          ))}
          {visibleLeads.map((l) => (
            <button
              key={l.id}
              onClick={() => handleViewLeadDocs(l.id, l.name)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                selectedClientId === l.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                {l.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <span className="flex-1 text-sm font-medium text-slate-700 truncate">{l.name}</span>
              <span className="text-[10px] font-semibold text-blue-600 shrink-0">View</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
