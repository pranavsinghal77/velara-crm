import type { Lead } from '../../types/models';

export const SOURCES: Lead['source'][] = ['JustDial', 'IndiaMART', 'Website', 'WhatsApp', 'Referral'];
export const STATUSES: Lead['status'][] = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost'];
export const PER_PAGE = 8;

export const sourceBase: Record<string, number> = {
  Referral: 90, JustDial: 85, IndiaMART: 80, Website: 70, WhatsApp: 65,
};

export const sourceBadge: Record<string, string> = {
  JustDial: 'bg-blue-100 text-blue-700',
  IndiaMART: 'bg-orange-100 text-orange-700',
  Website: 'bg-green-100 text-green-700',
  WhatsApp: 'bg-teal-100 text-teal-700',
  Referral: 'bg-purple-100 text-purple-700',
};

export const statusBadge: Record<string, { bg: string; dot: string }> = {
  New: { bg: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  Contacted: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  Qualified: { bg: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  Negotiation: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  Won: { bg: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  Lost: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export function scoreColor(s: number) {
  if (s > 75) return 'text-green-600 border-green-500';
  if (s >= 50) return 'text-orange-600 border-orange-500';
  return 'text-red-600 border-red-500';
}

export function daysSince(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export type Prediction = {
  label: string;
  cls: string;
  tip: string;
};

export function getPrediction(score: number, status: Lead['status']): Prediction {
  if (status === 'Won')
    return { label: '✅ Closed Won', cls: 'bg-green-100 text-green-700', tip: 'Deal successfully closed!' };
  if (status === 'Lost')
    return { label: '❌ Lost', cls: 'bg-red-100 text-red-600', tip: 'Mark reasons & archive lead.' };
  if (score > 80 && (status === 'Qualified' || status === 'Negotiation'))
    return { label: '🎯 Close in 7d', cls: 'bg-green-100 text-green-700', tip: 'Send final proposal + pricing sheet' };
  if (score > 70 && status === 'Contacted')
    return { label: '📈 High Potential', cls: 'bg-blue-100 text-blue-700', tip: 'Schedule demo call this week' };
  if (score > 60 && status === 'New')
    return { label: '👀 Needs Nurturing', cls: 'bg-amber-100 text-amber-700', tip: 'Add to WhatsApp drip campaign' };
  if (score < 50)
    return { label: '❄️ Cold Lead', cls: 'bg-slate-100 text-slate-600', tip: 'Re-engage with value content' };
  return { label: '📊 In Progress', cls: 'bg-indigo-100 text-indigo-700', tip: 'Continue regular follow-up' };
}

export const today = () => new Date().toISOString().slice(0, 10);

export const emptyLead = (): Omit<Lead, 'id' | 'createdAt' | 'lastContact' | 'aiScore' | 'aiScoreBreakdown' | 'isHot' | 'tags'> => ({
  name: '', phone: '', email: '', company: '', designation: '', city: '', budget: '',
  source: 'JustDial', status: 'New', notes: '', assignedTo: '',
});
