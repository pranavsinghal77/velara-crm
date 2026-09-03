import type { Platform } from './types';

/** Per-channel display tokens. Data only, so it lives outside the .tsx. */
export const PLATFORM_CONFIG: Record<Platform, { label: string; selectedCls: string; dotBg: string; iconBg: string }> = {
  IG: { label: 'Instagram', selectedCls: 'border-2 border-pink-500 bg-pink-50 text-pink-600',    dotBg: 'bg-pink-500',   iconBg: 'bg-gradient-to-br from-pink-500 to-orange-400' },
  FB: { label: 'Facebook',  selectedCls: 'border-2 border-indigo-500 bg-indigo-50 text-indigo-600', dotBg: 'bg-indigo-500', iconBg: 'bg-indigo-600' },
  LI: { label: 'LinkedIn',  selectedCls: 'border-2 border-blue-500 bg-blue-50 text-blue-600',    dotBg: 'bg-blue-500',   iconBg: 'bg-[#0A66C2]' },
  X:  { label: 'X',         selectedCls: 'border-2 border-gray-700 bg-gray-100 text-gray-800',   dotBg: 'bg-gray-800',   iconBg: 'bg-gray-900' },
  WA: { label: 'WhatsApp',  selectedCls: 'border-2 border-green-500 bg-green-50 text-green-600', dotBg: 'bg-green-500',  iconBg: 'bg-green-500' },
};
