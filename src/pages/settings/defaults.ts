/**
 * Default values for the per-device settings tabs.
 *
 * These sat alongside their components, which meant each tab file exported a
 * component *and* data - enough to break React fast refresh for the whole
 * settings screen.
 */

export interface AppearSettings {
  theme: string; primaryColor: string; compact: boolean; fontSize: string;
  showAiBadges: boolean; animations: boolean; showWelcome: boolean;
}

export const APPEAR_DEF: AppearSettings = {
  theme: 'Light', primaryColor: '#2563EB', compact: false, fontSize: 'Medium',
  showAiBadges: true, animations: true, showWelcome: true,
};

export interface CrmSettings {
  companyName: string; companyEmail: string; companyPhone: string; industry: string; city: string; website: string;
  hotThreshold: number; followUpDays: string;
  autoAssign: boolean; roundRobin: boolean;
  jdWeight: number; imWeight: number; webWeight: number; waWeight: number;
  aiScoring: boolean; aiFollowUp: boolean; aiTranscription: boolean; aiPostGen: boolean; aiLang: string;
}

export const CRM_DEF: CrmSettings = {
  companyName: 'Velara Tech Pvt Ltd', companyEmail: 'hello@velara.in', companyPhone: '+91 98765 43210', industry: 'IT Services', city: 'Bengaluru, India', website: 'www.velara.in',
  hotThreshold: 85, followUpDays: '2 days',
  autoAssign: true, roundRobin: false, jdWeight: 85, imWeight: 80, webWeight: 70, waWeight: 65,
  aiScoring: true, aiFollowUp: true, aiTranscription: true, aiPostGen: true, aiLang: 'English',
};

export interface NotifSettings {
  whatsapp: boolean; email: boolean; sms: boolean; browser: boolean; callNotif: boolean; aiInsights: boolean;
  hotLead: boolean; followUpReminder: boolean; reminderBefore: string; dealWon: boolean; churnRisk: boolean; dailySummary: boolean;
}

export const NOTIF_DEF: NotifSettings = {
  whatsapp: true, email: true, sms: false, browser: true, callNotif: true, aiInsights: true,
  hotLead: true, followUpReminder: true, reminderBefore: '1 hour', dealWon: true,
  churnRisk: true, dailySummary: true,
};
