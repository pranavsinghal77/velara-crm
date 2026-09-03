import { Sparkles, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Doc } from './types';

interface DocExtractModalProps {
  extractDoc: Doc | null;
  extracting: boolean;
  extracted: boolean;
  closeExtract: () => void;
  setNotice: (msg: string) => void;
}

export default function DocExtractModal({
  extractDoc,
  extracting,
  extracted,
  closeExtract,
  setNotice,
}: DocExtractModalProps) {
  const navigate = useNavigate();

  if (!extractDoc) return null;

  function downloadTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#7C3AED]" />
            <h3 className="text-base font-bold text-slate-900">AI Document Extraction</h3>
          </div>
          <button onClick={closeExtract} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-slate-500 mb-4 truncate font-medium">{extractDoc.name}</p>

          {extracting ? (
            <div className="flex flex-col items-center py-10">
              <Loader2 size={36} className="text-purple-500 animate-spin mb-3" />
              <p className="text-sm text-slate-600 font-medium">Analysing document with AI...</p>
            </div>
          ) : extracted ? (
            <div className="space-y-4">
              {/* Extracted table */}
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Extracted Information</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {([
                    ['Document Type',  'Service Contract'],
                    ['Party Name',     'Kumar Enterprises'],
                    ['Contract Value', '₹5,00,000'],
                    ['Start Date',     `01 April ${new Date().getFullYear()}`],
                    ['End Date',       `31 March ${new Date().getFullYear() + 1}`],
                    ['Signatures',     '2 signatures detected'],
                    ['Status',         'Valid & Active'],
                  ]).map(([k, v], i) => (
                    <div key={k} className={`flex items-center text-xs px-3 py-2 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                      <span className="w-36 font-semibold text-slate-600 shrink-0">{k}</span>
                      <span className="text-slate-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key terms */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-1.5">Key Terms</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Payment: Net 30', 'Auto-renewal: Yes', 'Notice period: 60 days'].map((t) => (
                    <span key={t} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">{t}</span>
                  ))}
                </div>
              </div>

              {/* Confidence */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-slate-700">AI Confidence</p>
                  <span className="text-xs font-bold text-green-600">96%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '96%' }} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {extracted && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
            <button onClick={closeExtract} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Close
            </button>
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
  );
}
