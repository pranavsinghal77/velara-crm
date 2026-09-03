import React from 'react';
import { X, CloudUpload, FileText, CheckCircle, Sparkles } from 'lucide-react';
import type { Lead } from '../../types/models';
import type { DocCategory } from './types';


interface DocUploadModalProps {
  showUpload: boolean;
  closeUpload: () => void;
  uploadFile: File | null;
  setUploadFile: (f: File | null) => void;
  uploadLead: string;
  setUploadLead: (l: string) => void;
  uploadCategory: Exclude<DocCategory, 'All Documents'>;
  setUploadCategory: (c: Exclude<DocCategory, 'All Documents'>) => void;
  uploadProgress: number;
  uploadDone: boolean;
  handleFileDrop: (e: React.DragEvent) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleUpload: () => void;
  leads: Lead[];
}

export default function DocUploadModal({
  showUpload,
  closeUpload,
  uploadFile,
  setUploadFile,
  uploadLead,
  setUploadLead,
  uploadCategory,
  setUploadCategory,
  uploadProgress,
  uploadDone,
  handleFileDrop,
  handleFileInput,
  fileInputRef,
  handleUpload,
  leads,
}: DocUploadModalProps) {
  if (!showUpload) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Upload Document</h3>
          <button onClick={closeUpload} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Drop zone */}
          {!uploadFile ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
            >
              <CloudUpload size={36} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Drag & drop file here</p>
              <p className="text-xs text-slate-400 mt-0.5">or click to browse files</p>
              <p className="text-[10px] text-slate-400 mt-2">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</p>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" onChange={handleFileInput} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <FileText size={24} className="text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{uploadFile.name}</p>
                  <p className="text-xs text-slate-400">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                {!uploadDone && (
                  <button onClick={() => setUploadFile(null)} className="p-1 rounded hover:bg-slate-200 text-slate-400">
                    <X size={14} />
                  </button>
                )}
              </div>

              {!uploadDone && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Assign to Lead</label>
                    <select
                      value={uploadLead}
                      onChange={(e) => setUploadLead(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select Lead —</option>
                      {leads.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Category</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as Exclude<DocCategory, 'All Documents'>)}
                      className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {(['Contracts', 'Proposals', 'KYC Documents', 'Reports', 'Other'] as const).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {uploadProgress > 0 && !uploadDone && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Uploading & processing...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
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
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={closeUpload} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          {!uploadDone && (
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploadProgress > 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#7C3AED] rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
            >
              <Sparkles size={14} /> Upload & AI Process
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
