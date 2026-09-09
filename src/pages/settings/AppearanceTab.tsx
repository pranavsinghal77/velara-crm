import { useState } from 'react';

import { Palette, Check, Paintbrush } from 'lucide-react';
import { Toggle } from './shared';
import { loadJson, saveJson } from './storage';
import { APPEAR_DEF, type AppearSettings } from './defaults';

export default function AppearanceTab() {
  const [appear, setAppear] = useState<AppearSettings>(() => loadJson('velara_settings_appear', APPEAR_DEF));
  function saveAppear(v: AppearSettings) { setAppear(v); saveJson('velara_settings_appear', v); }

  return (
    <>
      {/* Theme */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">Theme</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {([
            { id: 'Light', label: 'Light', soon: false },
            { id: 'Dark',  label: 'Dark',  soon: true  },
            { id: 'Auto',  label: 'Auto (System)', soon: true },
          ] as const).map((t) => {
            const sel = appear.theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { if (!t.soon) saveAppear({ ...appear, theme: t.id }); }}
                className={`relative rounded-xl border-2 p-4 text-left transition-colors ${sel ? 'border-blue-600' : 'border-slate-200 hover:border-slate-300'} ${t.soon ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`w-full h-20 rounded-lg mb-3 overflow-hidden border ${t.id === 'Light' ? 'bg-white' : t.id === 'Dark' ? 'bg-slate-900' : 'bg-gradient-to-r from-white to-slate-900'}`}>
                  <div className="flex h-full">
                    <div className={`w-6 h-full ${t.id === 'Dark' ? 'bg-slate-800' : 'bg-slate-800'}`} />
                    <div className="flex-1 p-1.5 flex flex-col gap-1">
                      <div className={`h-2 rounded ${t.id === 'Dark' ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      <div className={`h-2 w-3/4 rounded ${t.id === 'Dark' ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      <div className={`flex-1 rounded mt-1 ${t.id === 'Dark' ? 'bg-slate-800' : 'bg-slate-100'}`} />
                    </div>
                  </div>
                </div>
                <p className={`text-xs font-semibold text-center ${sel ? 'text-blue-700' : 'text-slate-700'}`}>{t.label}</p>
                {sel && <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                {t.soon && <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Coming Soon</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brand Color */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Paintbrush className="w-4 h-4 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">Brand Color</h2>
        </div>
        <div className="flex gap-4">
          {([
            { c: '#2563EB', label: 'Blue'   },
            { c: '#7C3AED', label: 'Purple' },
            { c: '#059669', label: 'Green'  },
            { c: '#EA580C', label: 'Orange' },
            { c: '#E11D48', label: 'Rose'   },
          ]).map((s) => {
            const sel = appear.primaryColor === s.c;
            return (
              <button key={s.c} onClick={() => saveAppear({ ...appear, primaryColor: s.c })} className="flex flex-col items-center gap-1 group">
                <div className={`w-10 h-10 rounded-full transition-transform group-hover:scale-110 border-4 ${sel ? 'border-slate-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: s.c }} />
                <span className="text-[10px] text-slate-500">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Display Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Display Preferences</h2>
        <div className="flex flex-col gap-4">
          {([
            { key: 'compact' as const,     label: 'Compact Mode',          desc: 'Reduce padding for more content visibility'   },
            { key: 'showAiBadges' as const, label: 'Show AI Badges',        desc: 'Show AI score badges on lead cards'            },
            { key: 'animations' as const,   label: 'Animations',            desc: 'Enable smooth page transitions'               },
            { key: 'showWelcome' as const,  label: 'Show Welcome Message',  desc: 'Show AI daily briefing on dashboard'          },
          ]).map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
              <Toggle on={appear[item.key]} onToggle={() => saveAppear({ ...appear, [item.key]: !appear[item.key] })} />
            </div>
          ))}

          <div>
            <p className="text-sm font-medium text-slate-800 mb-2">Font Size</p>
            <div className="flex gap-2">
              {['Small','Medium','Large'].map((v) => (
                <button key={v} onClick={() => saveAppear({ ...appear, fontSize: v })}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${appear.fontSize === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
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
