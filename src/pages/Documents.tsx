import { useState, useMemo, useRef } from 'react';
import {
  FolderOpen,
  Upload,
  Sparkles,
  Download,
  Trash2,
  Search,
  X,
  FileText,
  FileSpreadsheet,
  Image,
  File,
  CloudUpload,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getLeads } from '../types/index';

// ─── types ────────────────────────────────────────────────────────────────────

type DocCategory = 'All Documents' | 'Contracts' | 'Proposals' | 'KYC Documents' | 'Reports' | 'Other';
type FileType = 'pdf' | 'docx' | 'xlsx' | 'img';

interface Doc {
  id: string;
  name: string;
  leadName: string;
  leadId: string;
  size: string;
  date: string;
  category: Exclude<DocCategory, 'All Documents'>;
  fileType: FileType;
}

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_DOCS: Doc[] = [
  { id: 'd1', name: 'Rajesh_Kumar_Contract.pdf',       leadName: 'Rajesh Kumar',  leadId: 'lead_1',  size: '2.3 MB', date: 'Mar 08, 2026', category: 'Contracts',     fileType: 'pdf'  },
  { id: 'd2', name: 'Priya_Sharma_Proposal.pdf',        leadName: 'Priya Sharma',  leadId: 'lead_2',  size: '1.1 MB', date: 'Mar 07, 2026', category: 'Proposals',     fileType: 'pdf'  },
  { id: 'd3', name: 'Amit_Patel_KYC.pdf',               leadName: 'Amit Patel',    leadId: 'lead_3',  size: '0.8 MB', date: 'Mar 06, 2026', category: 'KYC Documents', fileType: 'pdf'  },
  { id: 'd4', name: 'Kumar_Enterprises_Agreement.docx', leadName: 'Rajesh Kumar',  leadId: 'lead_1',  size: '1.5 MB', date: 'Mar 05, 2026', category: 'Contracts',     fileType: 'docx' },
  { id: 'd5', name: 'Q1_Sales_Report.xlsx',             leadName: '—',             leadId: '',        size: '3.2 MB', date: 'Mar 04, 2026', category: 'Reports',       fileType: 'xlsx' },
  { id: 'd6', name: 'Sunita_Verma_Proposal.pdf',        leadName: 'Sunita Verma',  leadId: 'lead_4',  size: '0.9 MB', date: 'Mar 03, 2026', category: 'Proposals',     fileType: 'pdf'  },
  { id: 'd7', name: 'Arjun_Mehta_Contract.pdf',         leadName: 'Arjun Mehta',   leadId: 'lead_5',  size: '2.1 MB', date: 'Mar 02, 2026', category: 'Contracts',     fileType: 'pdf'  },
  { id: 'd8', name: 'Team_Performance_Q1.xlsx',         leadName: '—',             leadId: '',        size: '1.8 MB', date: 'Mar 01, 2026', category: 'Reports',       fileType: 'xlsx' },
  { id: 'd9', name: 'Anita_Desai_KYC.pdf',              leadName: 'Anita Desai',   leadId: 'lead_6',  size: '0.7 MB', date: 'Feb 28, 2026', category: 'KYC Documents', fileType: 'pdf'  },
];

const CATEGORIES: { label: DocCategory; emoji: string; count: number }[] = [
  { label: 'All Documents',  emoji: '📋', count: 47 },
  { label: 'Contracts',      emoji: '📜', count: 12 },
  { label: 'Proposals',      emoji: '💰', count: 8  },
  { label: 'KYC Documents',  emoji: '🪪', count: 11 },
  { label: 'Reports',        emoji: '📊', count: 9  },
  { label: 'Other',          emoji: '📸', count: 7  },
];

const catBadge: Record<string, string> = {
  Contracts:     'bg-blue-100 text-blue-700',
  Proposals:     'bg-amber-100 text-amber-700',
  'KYC Documents': 'bg-purple-100 text-purple-700',
  Reports:       'bg-green-100 text-green-700',
  Other:         'bg-gray-100 text-gray-600',
};

function FileIcon({ type, size = 32 }: { type: FileType; size?: number }) {
  if (type === 'pdf')  return <FileText  size={size} className="text-red-500"    />;
  if (type === 'docx') return <File      size={size} className="text-blue-500"   />;
  if (type === 'xlsx') return <FileSpreadsheet size={size} className="text-green-600" />;
  return <Image size={size} className="text-purple-500" />;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Documents() {
  const navigate = useNavigate();
  const leads = useMemo(() => getLeads(), []);

  const [docs, setDocs] = useState<Doc[]>(MOCK_DOCS);
  const [activeCategory, setActiveCategory] = useState<DocCategory>('All Documents');
  const [search, setSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');

  // AI extract modal
  const [extractDoc, setExtractDoc] = useState<Doc | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLead, setUploadLead] = useState('');
  const [uploadCategory, setUploadCategory] = useState<Exclude<DocCategory, 'All Documents'>>('Contracts');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── filtered grid ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = docs;
    if (selectedClientId) list = list.filter((d) => d.leadId === selectedClientId);
    if (activeCategory !== 'All Documents') list = list.filter((d) => d.category === activeCategory);
    if (search.trim()) list = list.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.leadName.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [docs, selectedClientId, activeCategory, search]);

  // ── client list ───────────────────────────────────────────
  const clientDocs = useMemo(() => {
    const m = new Map<string, { leadId: string; name: string; count: number }>();
    docs.forEach((d) => {
      if (!d.leadId) return;
      const e = m.get(d.leadId) || { leadId: d.leadId, name: d.leadName, count: 0 };
      e.count++;
      m.set(d.leadId, e);
    });
    return Array.from(m.values()).slice(0, 5);
  }, [docs]);

  const visibleClientDocs = useMemo(() => {
    if (!clientSearch.trim()) return clientDocs;
    const q = clientSearch.toLowerCase();
    return clientDocs.filter((c) => c.name.toLowerCase().includes(q));
  }, [clientDocs, clientSearch]);

  const visibleLeads = useMemo(() => {
    const leadIdsWithDocs = new Set(clientDocs.map((c) => c.leadId));
    const base = leads.filter((lead) => !leadIdsWithDocs.has(lead.id));
    if (!clientSearch.trim()) return base.slice(0, Math.max(0, 5 - visibleClientDocs.length));
    const q = clientSearch.toLowerCase();
    return base
      .filter((lead) => lead.name.toLowerCase().includes(q))
      .slice(0, Math.max(0, 5 - visibleClientDocs.length));
  }, [clientDocs, leads, clientSearch, visibleClientDocs.length]);

  // ── AI extract ────────────────────────────────────────────
  function openExtract(doc: Doc) {
    setExtractDoc(doc);
    setExtracting(true);
    setExtracted(false);
    setTimeout(() => { setExtracting(false); setExtracted(true); }, 1200);
  }

  function closeExtract() { setExtractDoc(null); setExtracting(false); setExtracted(false); }

  // ── delete ────────────────────────────────────────────────
  function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setNotice('Document deleted.');
  }

  function handleDownloadDoc(doc: Doc) {
    const lines = [
      `Document: ${doc.name}`,
      `Lead: ${doc.leadName || 'N/A'}`,
      `Category: ${doc.category}`,
      `Size: ${doc.size}`,
      `Date: ${doc.date}`,
      '',
      'This is a generated CRM export summary for operational workflows.',
    ];
    downloadTextFile(`${doc.name}.txt`, lines.join('\n'));
    setNotice(`Downloaded ${doc.name}.`);
  }

  function handleViewLeadDocs(leadId: string, leadName: string) {
    setSelectedClientId(leadId);
    setSelectedClientName(leadName);
    setSearch('');
    setActiveCategory('All Documents');
    setNotice(`Showing all documents for ${leadName}.`);
  }

  function clearClientFilter() {
    setSelectedClientId('');
    setSelectedClientName('');
    setNotice('Showing all client documents.');
  }

  // ── upload ────────────────────────────────────────────────
  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setUploadFile(f);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setUploadFile(f);
  }

  function handleUpload() {
    if (!uploadFile) return;
    setUploadProgress(0);
    const iv = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 100) {
          clearInterval(iv);
          setUploadDone(true);
          const lead = leads.find((l) => l.id === uploadLead);
          const nextDoc: Doc = {
            id: `d_${Date.now()}`,
            name: uploadFile.name,
            leadName: lead?.name ?? '—',
            leadId: lead?.id ?? '',
            size: `${(uploadFile.size / 1024 / 1024).toFixed(1)} MB`,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
            category: uploadCategory,
            fileType: uploadFile.name.toLowerCase().endsWith('.xlsx') || uploadFile.name.toLowerCase().endsWith('.xls')
              ? 'xlsx'
              : uploadFile.name.toLowerCase().endsWith('.doc') || uploadFile.name.toLowerCase().endsWith('.docx')
              ? 'docx'
              : uploadFile.type.startsWith('image/')
              ? 'img'
              : 'pdf',
          };
          setDocs((prev) => [nextDoc, ...prev]);
          setNotice(`Uploaded ${uploadFile.name} successfully.`);
          return 100;
        }
        return p + 20;
      });
    }, 200);
  }

  function closeUpload() {
    setShowUpload(false);
    setUploadFile(null);
    setUploadLead('');
    setUploadCategory('Contracts');
    setUploadProgress(0);
    setUploadDone(false);
    setNotice('');
  }

  // ── render ────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      {/* ═══ HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen size={22} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Document Manager</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">AI-powered client document storage & extraction</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
          <Upload size={16} /> Upload Document
        </button>
      </div>
      {notice ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="hover:text-blue-900">Dismiss</button>
        </div>
      ) : null}

      {/* ═══ STAT CARDS ══════════════════════════════════════ */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { label: 'Total Documents', value: '47',    color: 'text-blue-600 bg-blue-50',   icon: FolderOpen },
          { label: 'AI Processed',    value: '43',    color: 'text-purple-600 bg-purple-50', icon: Sparkles },
          { label: 'Pending Review',  value: '4',     color: 'text-amber-600 bg-amber-50',  icon: FileText },
          { label: 'Storage Used',    value: '2.3 GB',color: 'text-green-600 bg-green-50',  icon: CloudUpload },
        ] as const).map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">{c.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.color}`}><Icon size={16} /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* ═══ TWO COLUMNS ═════════════════════════════════════ */}
      <div className="flex gap-5">
        {/* ─── LEFT ─────────────────────────────────────────── */}
        <div className="w-[35%] space-y-4 min-w-0">
          {/* Categories */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Categories</h3>
            <div className="space-y-1">
              {CATEGORIES.map((c) => (
                <button key={c.label} onClick={() => setActiveCategory(c.label)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${activeCategory === c.label ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <span>{c.emoji} {c.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeCategory === c.label ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{c.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Clients with docs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Clients with Documents</h3>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search client profile..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              {visibleClientDocs.map((c) => (
                <button
                  key={c.leadId}
                  onClick={() => handleViewLeadDocs(c.leadId, c.name)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${selectedClientId === c.leadId ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {c.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{c.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">{c.count} docs</span>
                </button>
              ))}
              {visibleLeads.map((l) => (
                <button
                  key={l.id}
                  onClick={() => handleViewLeadDocs(l.id, l.name)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${selectedClientId === l.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold shrink-0">
                    {l.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-700 truncate">{l.name}</span>
                  <span className="text-[10px] font-semibold text-blue-600 shrink-0">View</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT ────────────────────────────────────────── */}
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
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Document grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <FolderOpen size={40} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No documents found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filtered.map((doc) => (
                <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <FileIcon type={doc.fileType} size={32} />
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${catBadge[doc.category]}`}>{doc.category}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={doc.name}>{doc.name}</p>
                    <p className="text-xs text-gray-400 truncate">{doc.leadName}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{doc.size} · {doc.date}</p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 border-t border-gray-50">
                    <button onClick={() => openExtract(doc)} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors flex-1 justify-center">
                      <Sparkles size={11} /> AI Extract
                    </button>
                    <button onClick={() => handleDownloadDoc(doc)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"><Download size={13} /></button>
                    <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ AI EXTRACT MODAL ════════════════════════════════ */}
      {extractDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#7C3AED]" />
                <h3 className="text-base font-bold text-gray-900">AI Document Extraction</h3>
              </div>
              <button onClick={closeExtract} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-gray-500 mb-4 truncate font-medium">{extractDoc.name}</p>

              {extracting ? (
                <div className="flex flex-col items-center py-10">
                  <Loader2 size={36} className="text-purple-500 animate-spin mb-3" />
                  <p className="text-sm text-gray-600 font-medium">Analysing document with AI...</p>
                </div>
              ) : extracted ? (
                <div className="space-y-4">
                  {/* Extracted table */}
                  <div>
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Extracted Information</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {([
                        ['Document Type',  'Service Contract'],
                        ['Party Name',     'Kumar Enterprises'],
                        ['Contract Value', '₹5,00,000'],
                        ['Start Date',     '01 April 2026'],
                        ['End Date',       '31 March 2027'],
                        ['Signatures',     '2 signatures detected'],
                        ['Status',         'Valid & Active'],
                      ]).map(([k, v], i) => (
                        <div key={k} className={`flex items-center text-xs px-3 py-2 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                          <span className="w-36 font-semibold text-gray-600 shrink-0">{k}</span>
                          <span className="text-gray-800">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Key terms */}
                  <div>
                    <p className="text-xs font-bold text-gray-700 mb-1.5">Key Terms</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Payment: Net 30', 'Auto-renewal: Yes', 'Notice period: 60 days'].map((t) => (
                        <span key={t} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">{t}</span>
                      ))}
                    </div>
                  </div>

                  {/* Confidence */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-gray-700">AI Confidence</p>
                      <span className="text-xs font-bold text-green-600">96%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '96%' }} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            {extracted && (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
                <button onClick={closeExtract} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Close</button>
                <button
                  onClick={() => {
                    closeExtract();
                    if (extractDoc?.leadId) {
                      navigate('/leads');
                    }
                    setNotice(`AI extraction linked for ${extractDoc?.leadName ?? 'selected lead'}.`);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#7C3AED] rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Save to Lead Profile
                </button>
                <button
                  onClick={() => {
                    downloadTextFile(
                      `${extractDoc?.name ?? 'document'}_summary.txt`,
                      [
                        `Summary for ${extractDoc?.name ?? 'Document'}`,
                        'Document Type: Service Contract',
                        'Party Name: Kumar Enterprises',
                        'Contract Value: ₹5,00,000',
                        'Status: Valid & Active',
                        'AI Confidence: 96%',
                      ].join('\n'),
                    );
                    setNotice('Summary downloaded.');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Download Summary
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ UPLOAD MODAL ════════════════════════════════════ */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Upload Document</h3>
              <button onClick={closeUpload} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Drop zone */}
              {!uploadFile ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                >
                  <CloudUpload size={36} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-semibold text-gray-700">Drag & drop file here</p>
                  <p className="text-xs text-gray-400 mt-0.5">or click to browse files</p>
                  <p className="text-[10px] text-gray-400 mt-2">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</p>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" onChange={handleFileInput} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <FileText size={24} className="text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{uploadFile.name}</p>
                      <p className="text-xs text-gray-400">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    {!uploadDone && <button onClick={() => setUploadFile(null)} className="p-1 rounded hover:bg-gray-200 text-gray-400"><X size={14} /></button>}
                  </div>

                  {!uploadDone && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Assign to Lead</label>
                        <select value={uploadLead} onChange={(e) => setUploadLead(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">— Select Lead —</option>
                          {getLeads().map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Category</label>
                        <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as typeof uploadCategory)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {(['Contracts','Proposals','KYC Documents','Reports','Other'] as const).map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  {uploadProgress > 0 && !uploadDone && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Uploading & processing...</span><span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {uploadDone && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <CheckCircle size={16} className="text-green-500 shrink-0" />
                      <p className="text-sm font-semibold text-green-700">✅ Uploaded & AI processed</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <button onClick={closeUpload} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              {!uploadDone && (
                <button onClick={handleUpload} disabled={!uploadFile || uploadProgress > 0} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#7C3AED] rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors">
                  <Sparkles size={14} /> Upload & AI Process
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
