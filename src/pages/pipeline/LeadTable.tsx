import React from 'react';
import { Eye, Pencil, Trash2, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Lead } from '../../types/models';
import { sourceBadge, statusBadge, scoreColor, getPrediction, daysSince, PER_PAGE } from './types';

interface LeadTableProps {
  paged: Lead[];
  selected: Set<string>;
  toggleAll: () => void;
  toggleOne: (id: string) => void;
  setViewId: (id: string | null) => void;
  openEdit: (l: Lead) => void;
  setDeleteId: (id: string | null) => void;
  filteredLength: number;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
}

export default function LeadTable({
  paged,
  selected,
  toggleAll,
  toggleOne,
  setViewId,
  openEdit,
  setDeleteId,
  filteredLength,
  page,
  setPage,
  totalPages,
}: LeadTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left">
            <th className="p-3 w-10">
              <input
                type="checkbox"
                checked={paged.length > 0 && paged.every((l) => selected.has(l.id))}
                onChange={toggleAll}
                className="rounded border-gray-300"
              />
            </th>
            <th className="p-3 font-semibold text-gray-600">LEAD</th>
            <th className="p-3 font-semibold text-gray-600">CONTACT</th>
            <th className="p-3 font-semibold text-gray-600">SOURCE</th>
            <th className="p-3 font-semibold text-gray-600">STATUS</th>
            <th className="p-3 font-semibold text-gray-600">AI SCORE</th>
            <th className="p-3 font-semibold text-gray-600">AI PREDICTION</th>
            <th className="p-3 font-semibold text-gray-600">LAST CONTACT</th>
            <th className="p-3 font-semibold text-gray-600 text-right">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {paged.map((l) => {
            const days = daysSince(l.lastContact);
            const prediction = getPrediction(l.aiScore, l.status);
            return (
              <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggleOne(l.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="p-3">
                  <p className="font-medium text-gray-900">{l.name}</p>
                  <p className="text-xs text-gray-400">{l.company ?? '—'}</p>
                </td>
                <td className="p-3">
                  <p className="text-gray-700">{l.phone}</p>
                  <p className="text-xs text-gray-400">{l.email}</p>
                </td>
                <td className="p-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sourceBadge[l.source]}`}>
                    {l.source}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusBadge[l.status].bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge[l.status].dot}`} />
                    {l.status}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full border-2 text-xs font-bold ${scoreColor(l.aiScore)}`}>
                      {l.aiScore}
                    </span>
                    {l.isHot && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                        <Flame size={12} /> HOT
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="group relative inline-block">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium cursor-default ${prediction.cls}`}>
                      {prediction.label}
                    </span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                      <div className="bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                        {prediction.tip}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <p className="text-gray-700">{l.lastContact}</p>
                  <p className="text-xs text-gray-400">{days === 0 ? 'Today' : `${days}d ago`}</p>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setViewId(l.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => openEdit(l)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-amber-600 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteId(l.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {paged.length === 0 && (
            <tr>
              <td colSpan={9} className="p-8 text-center text-gray-400">
                No leads found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* PAGINATION */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          Showing {Math.min((page - 1) * PER_PAGE + 1, filteredLength)}–{Math.min(page * PER_PAGE, filteredLength)} of {filteredLength}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-medium text-gray-600 px-2">
            {page} / {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
