import React from 'react';
import { useState, useMemo, useRef } from 'react';
import {
  FolderOpen,
  Upload,
  Sparkles,
  FileText,
  CloudUpload,
  Receipt,
  Download,
  Share2,
  Check,
  Building,
  Plus,
  Trash2,
  X,
  IndianRupee,
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

import DocSidebar from './documents/DocSidebar';
import DocGrid from './documents/DocGrid';
import DocExtractModal from './documents/DocExtractModal';
import DocUploadModal from './documents/DocUploadModal';

import { MOCK_DOCS } from './documents/types';
import type { Doc, DocCategory } from './documents/types';

interface QuoteItem {
  description: string;
  hsn: string;
  qty: number;
  rate: number;
}

export default function Documents() {
  const leads = useCrmStore((s) => s.leads);

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

  // ── GST Quotation Generator State ─────────────────────────
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteClient, setQuoteClient] = useState(leads[0]?.name || 'Rajesh Kumar');
  const [quoteCompany, setQuoteCompany] = useState(leads[0]?.company || 'Kumar Enterprises');
  const [quoteGstin, setQuoteGstin] = useState('27AAACK1234F1Z8');
  const [quoteState, setQuoteState] = useState('Maharashtra (27)');
  const [discountPercent, setDiscountPercent] = useState(20);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([
    { description: 'Velara CRM Enterprise Suite — 50 User Annual License', hsn: '997331', qty: 1, rate: 180000 },
    { description: 'Official WhatsApp Business Cloud API Connector & Setup', hsn: '998313', qty: 1, rate: 25000 },
    { description: 'TallyPrime & GST Auto-Sync Accounting Connector', hsn: '998314', qty: 1, rate: 20000 },
  ]);

  // Calculations
  const subTotal = useMemo(() => quoteItems.reduce((sum, item) => sum + item.qty * item.rate, 0), [quoteItems]);
  const discountAmount = useMemo(() => (subTotal * discountPercent) / 100, [subTotal, discountPercent]);
  const taxableAmount = useMemo(() => subTotal - discountAmount, [subTotal, discountAmount]);
  const cgst = useMemo(() => taxableAmount * 0.09, [taxableAmount]);
  const sgst = useMemo(() => taxableAmount * 0.09, [taxableAmount]);
  const grandTotal = useMemo(() => taxableAmount + cgst + sgst, [taxableAmount, cgst, sgst]);

  function addItem() {
    setQuoteItems([...quoteItems, { description: 'Custom Enterprise Integration', hsn: '998313', qty: 1, rate: 15000 }]);
  }

  function removeItem(index: number) {
    if (quoteItems.length <= 1) return;
    setQuoteItems(quoteItems.filter((_, i) => i !== index));
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

  function handleDownloadQuote() {
    const quoteText = `
============================================================
              VELARA TECHNOLOGIES PVT LTD
     GSTIN: 27AABCV9876Q1Z2 | CIN: U72200MH2024PTC123456
   Level 8, Platina Tower, BKC, Bandra East, Mumbai - 400051
============================================================
GST PROFORMA QUOTATION: QT-2026-${Math.floor(1000 + Math.random() * 9000)}
Date: ${new Date().toLocaleDateString('en-IN')}

BILL TO:
Client: ${quoteClient}
Company: ${quoteCompany}
GSTIN: ${quoteGstin}
Place of Supply: ${quoteState}

------------------------------------------------------------
LINE ITEMS & SERVICES:
${quoteItems.map((item, i) => `${i + 1}. ${item.description}\n   HSN: ${item.hsn} | Qty: ${item.qty} | Rate: ₹${item.rate.toLocaleString('en-IN')}`).join('\n')}
------------------------------------------------------------
Gross Subtotal:     ₹${subTotal.toLocaleString('en-IN')}
Annual Discount (${discountPercent}%): -₹${discountAmount.toLocaleString('en-IN')}
Taxable Value:      ₹${taxableAmount.toLocaleString('en-IN')}
CGST (9%):          ₹${cgst.toLocaleString('en-IN')}
SGST (9%):          ₹${sgst.toLocaleString('en-IN')}
------------------------------------------------------------
TOTAL AMOUNT DUE:   ₹${grandTotal.toLocaleString('en-IN')}
(Rupees ${Math.round(grandTotal).toLocaleString('en-IN')} Only)
------------------------------------------------------------
BANK PAYMENT DETAILS:
Bank: HDFC Bank Ltd | Account: 50200012345678
IFSC: HDFC0000123 | UPI: velara@hdfcbank
============================================================
    `;
    downloadTextFile(`Velara_Quotation_${quoteCompany.replace(/\s+/g, '_')}.txt`, quoteText);
    setNotice('GST Quotation generated and downloaded successfully!');
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

  function openExtract(doc: Doc) {
    setExtractDoc(doc);
    setExtracting(true);
    setExtracted(false);
    setTimeout(() => { setExtracting(false); setExtracted(true); }, 1200);
  }

  function closeExtract() { setExtractDoc(null); setExtracting(false); setExtracted(false); }

  function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setNotice('Document deleted.');
  }

  return (
    <div className="space-y-6 relative p-6">
      {notice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-700 flex items-center justify-between shadow-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="hover:text-blue-900 font-bold">Dismiss</button>
        </div>
      )}

      {/* ═══ HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm">
            <FolderOpen size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents & GST Proposals</h1>
            <p className="text-xs text-gray-500">Contract management, GST invoices, SOW agreements & AI data extraction.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuoteModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg shadow-sm transition-all"
          >
            <Receipt size={15} />
            Generate GST Quotation
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
          >
            <Upload size={15} />
            Upload Document
          </button>
        </div>
      </div>

      {/* ═══ MAIN LAYOUT ═════════════════════════════════════ */}
      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <DocSidebar
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          clientSearch={clientSearch}
          setClientSearch={setClientSearch}
          visibleClientDocs={visibleClientDocs}
          visibleLeads={visibleLeads}
          selectedClientId={selectedClientId}
          handleViewLeadDocs={(id, name) => {
            setSelectedClientId(id);
            setSelectedClientName(name);
          }}
        />

        {/* Grid */}
        <div className="flex-1 min-w-0">
          <DocGrid
            selectedClientId={selectedClientId}
            selectedClientName={selectedClientName}
            clearClientFilter={() => {
              setSelectedClientId('');
              setSelectedClientName('');
            }}
            search={search}
            setSearch={setSearch}
            filteredDocs={filtered}
            openExtract={openExtract}
            handleDownloadDoc={(doc) => downloadTextFile(doc.name, `${doc.name}\nClient: ${doc.leadName}\nDate: ${doc.date}\nCategory: ${doc.category}`)}
            handleDelete={handleDelete}
          />
        </div>
      </div>

      {/* ═══ GST PROFORMA QUOTATION MODAL ═════════════════════ */}
      {showQuoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={20} className="text-emerald-200" />
                <div>
                  <h3 className="font-bold text-base">GST Proforma Quotation & Invoice Builder</h3>
                  <p className="text-[11px] text-emerald-100">HSN/SAC Compliant with 18% GST (CGST + SGST) & Annual Discount</p>
                </div>
              </div>
              <button onClick={() => setShowQuoteModal(false)} className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Client Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Select Client / Lead:</label>
                  <select
                    value={quoteClient}
                    onChange={(e) => {
                      const found = leads.find((l) => l.name === e.target.value);
                      setQuoteClient(e.target.value);
                      if (found?.company) setQuoteCompany(found.company);
                    }}
                    className="w-full text-xs font-semibold px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    {leads.map((l) => (
                      <option key={l.id} value={l.name}>
                        {l.name} ({l.company || 'Direct Client'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Client GSTIN / State:</label>
                  <div className="flex gap-2">
                    <input
                      value={quoteGstin}
                      onChange={(e) => setQuoteGstin(e.target.value)}
                      placeholder="GSTIN Number"
                      className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-800">Proposal Line Items (SAC / HSN 9983):</label>
                  <button onClick={addItem} className="text-xs text-emerald-700 font-bold flex items-center gap-1 hover:underline">
                    <Plus size={13} /> Add Service
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-2 py-2 text-center w-16">HSN</th>
                        <th className="px-2 py-2 text-center w-12">Qty</th>
                        <th className="px-3 py-2 text-right w-24">Rate (₹)</th>
                        <th className="px-2 py-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {quoteItems.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50/60">
                          <td className="px-3 py-2">
                            <input
                              value={item.description}
                              onChange={(e) => {
                                const copy = [...quoteItems];
                                copy[index].description = e.target.value;
                                setQuoteItems(copy);
                              }}
                              className="w-full bg-transparent text-xs font-medium focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              value={item.hsn}
                              onChange={(e) => {
                                const copy = [...quoteItems];
                                copy[index].hsn = e.target.value;
                                setQuoteItems(copy);
                              }}
                              className="w-full text-center bg-transparent text-[11px] font-mono"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="number"
                              value={item.qty}
                              onChange={(e) => {
                                const copy = [...quoteItems];
                                copy[index].qty = Math.max(1, parseInt(e.target.value) || 1);
                                setQuoteItems(copy);
                              }}
                              className="w-full text-center bg-transparent text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => {
                                const copy = [...quoteItems];
                                copy[index].rate = Math.max(0, parseInt(e.target.value) || 0);
                                setQuoteItems(copy);
                              }}
                              className="w-full text-right bg-transparent text-xs font-mono font-bold"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-600">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Gross Subtotal:</span>
                  <span className="font-mono font-bold">₹{subTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-700">
                  <span className="flex items-center gap-1.5">
                    Annual Discount:
                    <select
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value))}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-white border border-emerald-300 font-bold"
                    >
                      <option value={0}>0%</option>
                      <option value={10}>10%</option>
                      <option value={20}>20% (Annual Special)</option>
                      <option value={25}>25% (Enterprise VIP)</option>
                    </select>
                  </span>
                  <span className="font-mono font-bold">-₹{discountAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Taxable Value:</span>
                  <span className="font-mono font-semibold">₹{taxableAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>CGST (9%) + SGST (9%):</span>
                  <span className="font-mono font-semibold">₹{(cgst + sgst).toLocaleString('en-IN')}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-gray-900">
                  <span>Total Amount Payable:</span>
                  <span className="font-mono text-base text-emerald-700">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Auto-calculated with HDFC UPI & Bank details</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={handleDownloadQuote}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                >
                  <Download size={13} />
                  Download Quotation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI extract modal */}
      <DocExtractModal
        extractDoc={extractDoc}
        extracting={extracting}
        extracted={extracted}
        closeExtract={closeExtract}
        setNotice={setNotice}
      />

      {/* Upload modal */}
      <DocUploadModal
        showUpload={showUpload}
        closeUpload={() => setShowUpload(false)}
        uploadFile={uploadFile}
        setUploadFile={setUploadFile}
        uploadLead={uploadLead}
        setUploadLead={setUploadLead}
        uploadCategory={uploadCategory}
        setUploadCategory={setUploadCategory}
        uploadProgress={uploadProgress}
        uploadDone={uploadDone}
        handleFileDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files[0]) setUploadFile(e.dataTransfer.files[0]);
        }}
        handleFileInput={(e) => {
          if (e.target.files?.[0]) setUploadFile(e.target.files[0]);
        }}
        fileInputRef={fileInputRef}
        handleUpload={() => {
          setShowUpload(false);
          setNotice('Document uploaded and indexed successfully.');
        }}
        leads={leads}
      />
    </div>
  );
}
