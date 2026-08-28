import { FolderOpen, Search, FileText, FileSpreadsheet, File, Image, Sparkles, Download, Trash2 } from 'lucide-react';
import { catBadge } from './types';
import type { Doc, FileType } from './types';

interface DocGridProps {
  selectedClientId: string;
  selectedClientName: string;
  clearClientFilter: () => void;
  search: string;
  setSearch: (s: string) => void;
  filteredDocs: Doc[];
  openExtract: (doc: Doc) => void;
  handleDownloadDoc: (doc: Doc) => void;
  handleDelete: (id: string) => void;
}

function FileIcon({ type, size = 32 }: { type: FileType; size?: number }) {
  if (type === 'pdf')  return <FileText  size={size} className="text-red-500"    />;
  if (type === 'docx') return <File      size={size} className="text-blue-500"   />;
  if (type === 'xlsx') return <FileSpreadsheet size={size} className="text-green-600" />;
  return <Image size={size} className="text-purple-500" />;
}

export default function DocGrid({
  selectedClientId,
  selectedClientName,
  clearClientFilter,
  search,
  setSearch,
  filteredDocs,
  openExtract,
  handleDownloadDoc,
  handleDelete,
}: DocGridProps) {
  return (
    <div className="flex-1 min-w-0">
      {selectedClientId ? (
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-center justify-between">
          <span>
            Client profile selected: <strong>{selectedClientName}</strong>. Showing only this customer's files.
          </span>
          <button onClick={clearClientFilter} className="font-semibold hover:text-blue-900">Clear</button>
        </div>
      ) : null}

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Document grid */}
      {filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <FolderOpen size={40} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No documents found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <FileIcon type={doc.fileType} size={32} />
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${catBadge[doc.category]}`}>
                  {doc.category}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate" title={doc.name}>{doc.name}</p>
                <p className="text-xs text-gray-400 truncate">{doc.leadName}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{doc.size} · {doc.date}</p>
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-gray-50">
                <button
                  onClick={() => openExtract(doc)}
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors flex-1 justify-center"
                >
                  <Sparkles size={11} /> AI Extract
                </button>
                <button onClick={() => handleDownloadDoc(doc)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                  <Download size={13} />
                </button>
                <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
