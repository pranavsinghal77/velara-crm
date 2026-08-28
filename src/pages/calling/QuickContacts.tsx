import { Star, Phone } from 'lucide-react';
import type { Lead } from '../../types/models';

interface QuickContactsProps {
  hotLeads: Lead[];
  onSelectLead: (l: Lead) => void;
}

export default function QuickContacts({ hotLeads, onSelectLead }: QuickContactsProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-bold text-gray-900">Quick Contacts</h3>
      </div>
      {hotLeads.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No hot leads</p>
      ) : (
        hotLeads.map((l) => (
          <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {l.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{l.name}</p>
                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{l.aiScore}</span>
              </div>
            </div>
            <button
              onClick={() => onSelectLead(l)}
              className="w-7 h-7 rounded-full bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors shrink-0"
            >
              <Phone className="w-3.5 h-3.5 text-green-600" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
