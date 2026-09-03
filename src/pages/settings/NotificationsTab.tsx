import { useState } from 'react';

import { Bell, MessageSquare, Mail, Phone, Sparkles, Flame, Clock, Trophy, TrendingDown, Calendar } from 'lucide-react';
import { Toggle } from './shared';
import { loadJson, saveJson } from './storage';
import { NOTIF_DEF, type NotifSettings } from './defaults';

export default function NotificationsTab() {
  const [notif, setNotif] = useState<NotifSettings>(() => loadJson('velara_notifications', NOTIF_DEF));
  function saveNotif(v: NotifSettings) { setNotif(v); saveJson('velara_notifications', v); }

  return (
    <>
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-gray-900">Notification Preferences</span>
        </div>
        <button onClick={() => saveNotif(notif)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Save All</button>
      </div>

      {/* Channel notifications */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Notification Channels</h3>
        </div>
        {([
          { key: 'whatsapp' as const,   Icon: MessageSquare, iconBg: 'bg-green-100 text-green-600',  title: 'WhatsApp Alerts',         desc: 'Lead + follow-up alerts via WhatsApp'   },
          { key: 'email' as const,       Icon: Mail,          iconBg: 'bg-blue-100 text-blue-600',    title: 'Email Notifications',     desc: 'Daily summary + alerts via email'       },
          { key: 'sms' as const,         Icon: MessageSquare, iconBg: 'bg-gray-100 text-gray-600',    title: 'SMS Reminders',           desc: 'Follow-up reminders via SMS'            },
          { key: 'browser' as const,     Icon: Bell,          iconBg: 'bg-indigo-100 text-indigo-600',title: 'Browser Push',            desc: 'Real-time alerts in browser'            },
          { key: 'callNotif' as const,   Icon: Phone,         iconBg: 'bg-green-100 text-green-600',  title: 'Call Notifications',      desc: 'Missed call + voicemail alerts'         },
          { key: 'aiInsights' as const,  Icon: Sparkles,      iconBg: 'bg-purple-100 text-purple-600',title: 'AI Insights',             desc: 'Daily AI performance briefing'          },
        ]).map((item) => (
          <div key={item.key} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.iconBg}`}>
                <item.Icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-800">{item.title}</span>
                <span className="text-xs text-gray-500">{item.desc}</span>
              </div>
            </div>
            <Toggle on={notif[item.key]} onToggle={() => saveNotif({ ...notif, [item.key]: !notif[item.key] })} />
          </div>
        ))}
      </div>

      {/* Alert types */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Alert Triggers</h3>
        </div>

        <div className="flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
              <Flame className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">HOT Lead Alert</p>
              <p className="text-xs text-gray-500">Instant alert when lead becomes HOT</p>
            </div>
          </div>
          <Toggle on={notif.hotLead} onToggle={() => saveNotif({ ...notif, hotLead: !notif.hotLead })} />
        </div>

        <div className="flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Follow-up Reminders</p>
              <p className="text-xs text-gray-500">Reminder before follow-up due</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select value={notif.reminderBefore} onChange={(e) => saveNotif({ ...notif, reminderBefore: e.target.value })}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
              {['30 min','1 hour','2 hours'].map((v) => <option key={v}>{v}</option>)}
            </select>
            <Toggle on={notif.followUpReminder} onToggle={() => saveNotif({ ...notif, followUpReminder: !notif.followUpReminder })} />
          </div>
        </div>

        {([
          { key: 'dealWon' as const,      Icon: Trophy,        bg: 'bg-green-100',  ic: 'text-green-600', title: 'Deal Won Alert',    desc: 'Celebrate every closed deal'             },
          { key: 'churnRisk' as const,     Icon: TrendingDown,  bg: 'bg-red-100',    ic: 'text-red-500',   title: 'Churn Risk Alert',  desc: 'Alert when lead shows disengagement'     },
          { key: 'dailySummary' as const,  Icon: Calendar,      bg: 'bg-blue-100',   ic: 'text-blue-600',  title: 'Daily Summary',     desc: 'Morning briefing every day at 9 AM'      },
        ]).map((item) => (
          <div key={item.key} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}>
                <item.Icon className={`w-5 h-5 ${item.ic}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
            <Toggle on={notif[item.key]} onToggle={() => saveNotif({ ...notif, [item.key]: !notif[item.key] })} />
          </div>
        ))}
      </div>
    </>
  );
}
