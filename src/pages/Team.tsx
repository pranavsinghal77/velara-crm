import { useMemo } from 'react';
import { Users, Target, TrendingUp, Brain, Mail, Phone, Star } from 'lucide-react';
import { getUsers, getLeads } from '../types/index';

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Team() {
  const users = useMemo(() => getUsers(), []);
  const leads = useMemo(() => getLeads(), []);

  const teamCards = useMemo(() => {
    return users.map((user) => {
      const assigned = leads.filter((lead) => lead.assignedTo === user.id);
      const won = assigned.filter((lead) => lead.status === 'Won').length;
      const avgAi = assigned.length
        ? Math.round(assigned.reduce((sum, lead) => sum + lead.aiScore, 0) / assigned.length)
        : 0;
      const closeRate = assigned.length ? Math.round((won / assigned.length) * 100) : 0;
      const coachingTip =
        closeRate >= 35
          ? 'Leverage this rep for enterprise deal mentoring this week.'
          : avgAi >= 75
            ? 'Strong lead quality. Improve call-to-proposal conversion.'
            : 'Prioritize cadence coaching and first-touch SLA discipline.';

      return {
        user,
        assigned: assigned.length,
        won,
        avgAi,
        closeRate,
        coachingTip,
      };
    });
  }, [leads, users]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Workspace</h1>
          <p className="text-sm text-gray-500">AI-assisted coaching, pipeline accountability, and performance visibility.</p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
          <Brain className="w-4 h-4" />
          Coaching AI Enabled
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Active Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{users.filter((u) => u.isActive).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Won Deals (Team)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{leads.filter((l) => l.status === 'Won').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Average AI Lead Score</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {leads.length
              ? Math.round(leads.reduce((sum, lead) => sum + lead.aiScore, 0) / leads.length)
              : 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {teamCards.map((card) => (
          <article key={card.user.id} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                  {initials(card.user.name)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{card.user.name}</p>
                  <p className="text-xs text-gray-500">{card.user.role}</p>
                </div>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${card.user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {card.user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] text-gray-500">Assigned</p>
                <p className="font-bold text-gray-900">{card.assigned}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] text-gray-500">Won</p>
                <p className="font-bold text-gray-900">{card.won}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] text-gray-500">Close %</p>
                <p className="font-bold text-gray-900">{card.closeRate}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] text-gray-500">Avg AI</p>
                <p className="font-bold text-gray-900">{card.avgAi}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
              <div className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Pipeline</div>
              <div className="inline-flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Outcomes</div>
              <div className="inline-flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Trend</div>
            </div>

            <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-xs text-violet-800">
              <p className="font-semibold inline-flex items-center gap-1"><Star className="w-3.5 h-3.5" /> AI Coaching Tip</p>
              <p className="mt-1">{card.coachingTip}</p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 text-gray-600"><Mail className="w-3.5 h-3.5" /> {card.user.email}</span>
              <span className="inline-flex items-center gap-1 text-gray-600"><Phone className="w-3.5 h-3.5" /> Assigned outreach managed in CRM</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
