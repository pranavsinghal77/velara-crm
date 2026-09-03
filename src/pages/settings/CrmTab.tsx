import { useState } from 'react';

import { Building2, Users, Sparkles } from 'lucide-react';
import { Toggle } from './shared';
import { loadJson, saveJson } from './storage';
import { CRM_DEF, type CrmSettings } from './defaults';

export default function CrmTab() {
  const [crm, setCrm] = useState<CrmSettings>(() => loadJson('velara_settings', CRM_DEF));
  function saveCrm(v: CrmSettings) { setCrm(v); saveJson('velara_settings', v); }

  return (
    <>
      {/* Company Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Company Information</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-600 block mb-1">Company Name</label>
            <input value={crm.companyName} onChange={(e) => setCrm({ ...crm, companyName: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Business Email</label>
            <input type="email" value={crm.companyEmail} onChange={(e) => setCrm({ ...crm, companyEmail: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Phone Number</label>
            <input value={crm.companyPhone} onChange={(e) => setCrm({ ...crm, companyPhone: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Industry</label>
            <select value={crm.industry} onChange={(e) => setCrm({ ...crm, industry: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['Real Estate','Manufacturing','IT Services','Retail','Healthcare','Education','Finance','Other'].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">City</label>
            <input value={crm.city} onChange={(e) => setCrm({ ...crm, city: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-600 block mb-1">Website URL</label>
            <input value={crm.website} onChange={(e) => setCrm({ ...crm, website: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={() => saveCrm(crm)} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Save Changes</button>
        </div>
      </div>

      {/* Lead Management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Lead Management Settings</h2>
        </div>
        <div className="flex flex-col gap-5">
          {/* HOT Threshold */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">HOT Lead Score Threshold</p>
              <p className="text-xs text-gray-500 mt-0.5">Leads scoring above this are marked HOT 🔥</p>
            </div>
            <div className="flex items-center gap-3">
              <input type="range" min={50} max={95} step={5} value={crm.hotThreshold}
                onChange={(e) => setCrm({ ...crm, hotThreshold: Number(e.target.value) })}
                className="w-32 accent-blue-600" />
              <span className="text-lg font-bold text-blue-600 w-12 text-right">{crm.hotThreshold}<span className="text-sm">/100</span></span>
            </div>
          </div>

          {/* Follow-up timing */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Auto Follow-up Timing</p>
              <p className="text-xs text-gray-500 mt-0.5">Default reminder timing for follow-ups</p>
            </div>
            <select value={crm.followUpDays} onChange={(e) => setCrm({ ...crm, followUpDays: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {['1 day','2 days','3 days','1 week'].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>

          {/* Assignment toggles */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Auto-assign new leads</p>
              <p className="text-xs text-gray-500 mt-0.5">Automatically assign leads to available reps</p>
            </div>
            <Toggle on={crm.autoAssign} onToggle={() => setCrm({ ...crm, autoAssign: !crm.autoAssign })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Round-robin assignment</p>
              <p className="text-xs text-gray-500 mt-0.5">Distribute leads equally across all reps</p>
            </div>
            <Toggle on={crm.roundRobin} onToggle={() => setCrm({ ...crm, roundRobin: !crm.roundRobin })} />
          </div>

          {/* Lead scoring weights */}
          <div>
            <p className="text-sm font-medium text-gray-800 mb-3">Lead Scoring Weights by Source</p>
            {([
              { label: 'JustDial', key: 'jdWeight' as const, color: 'bg-blue-100 text-blue-700' },
              { label: 'IndiaMART', key: 'imWeight' as const, color: 'bg-orange-100 text-orange-700' },
              { label: 'Website',  key: 'webWeight' as const, color: 'bg-green-100 text-green-700' },
              { label: 'WhatsApp', key: 'waWeight' as const,  color: 'bg-teal-100 text-teal-700' },
            ]).map((s) => (
              <div key={s.key} className="flex items-center gap-3 mb-3 last:mb-0">
                <span className={`text-xs font-semibold px-2 py-1 rounded w-24 text-center flex-shrink-0 ${s.color}`}>{s.label}</span>
                <input type="range" min={0} max={100} value={crm[s.key]}
                  onChange={(e) => setCrm({ ...crm, [s.key]: Number(e.target.value) })}
                  className="flex-1 accent-blue-600" />
                <span className="text-sm font-medium text-gray-700 w-12 text-right">{crm[s.key]}/100</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <h2 className="text-base font-semibold text-gray-900">Velara AI Settings</h2>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mb-4 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <p className="text-xs text-purple-700">These settings control Velara AI behavior across all modules including lead scoring, follow-up suggestions and call transcription.</p>
        </div>
        <div className="flex flex-col gap-4">
          {([
            { key: 'aiScoring' as const, label: 'AI Lead Scoring', desc: 'Automatically score leads 0-100 based on source, recency and profile completeness' },
            { key: 'aiFollowUp' as const, label: 'AI Follow-up Suggestions', desc: 'AI suggests optimal follow-up timing and message' },
            { key: 'aiTranscription' as const, label: 'AI Call Transcription', desc: 'Auto-transcribe all recorded calls' },
            { key: 'aiPostGen' as const, label: 'AI Post Generation', desc: 'Generate social media content with AI' },
          ]).map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
              <Toggle on={crm[item.key]} onToggle={() => saveCrm({ ...crm, [item.key]: !crm[item.key] })} />
            </div>
          ))}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">AI Response Language</p>
            <div className="flex gap-2">
              {['English','Hindi','Hinglish'].map((v) => (
                <button key={v} onClick={() => saveCrm({ ...crm, aiLang: v })}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${crm.aiLang === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
