import { useMemo, useState } from 'react';
import { Workflow, Sparkles, Play, Pause, Plus, Clock, Target, Send, Bell } from 'lucide-react';
import { getLeads } from '../types/index';

type FlowState = 'Running' | 'Paused';

type WorkflowItem = {
  id: string;
  name: string;
  trigger: string;
  actions: string[];
  state: FlowState;
  runsToday: number;
};

const baseFlows: WorkflowItem[] = [
  {
    id: 'wf-1',
    name: 'Hot Lead Escalation',
    trigger: 'AI score >= 85 and no response for 6h',
    actions: ['Create manager reminder', 'Send WhatsApp nudge', 'Tag as Priority'],
    state: 'Running',
    runsToday: 7,
  },
  {
    id: 'wf-2',
    name: 'Demo Follow-up Sequence',
    trigger: 'Lead status = Contacted and demo completed',
    actions: ['Send case study email', 'Schedule 24h follow-up call', 'Draft proposal template'],
    state: 'Running',
    runsToday: 5,
  },
  {
    id: 'wf-3',
    name: 'Cold Lead Re-engagement',
    trigger: 'AI score < 50 and 14d inactivity',
    actions: ['Enroll to nurture campaign', 'Send value checklist', 'Delay sales call by 7d'],
    state: 'Paused',
    runsToday: 0,
  },
];

export default function Workflows() {
  const leads = useMemo(() => getLeads(), []);
  const [flows, setFlows] = useState(baseFlows);

  const running = flows.filter((flow) => flow.state === 'Running').length;
  const generatedActions = flows.reduce((sum, flow) => sum + flow.runsToday, 0) * 3;

  function toggleFlow(id: string) {
    setFlows((current) =>
      current.map((flow) =>
        flow.id === id
          ? { ...flow, state: flow.state === 'Running' ? 'Paused' : 'Running' }
          : flow,
      ),
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Studio</h1>
          <p className="text-sm text-gray-500">Automate follow-ups, prioritization, and handoffs with AI-first sequences.</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Configured Workflows</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{flows.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Running</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{running}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">AI Actions Today</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{generatedActions}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Eligible Leads</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{leads.length}</p>
        </div>
      </div>

      <div className="space-y-4">
        {flows.map((flow) => (
          <article key={flow.id} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold text-gray-900 inline-flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-blue-600" />
                  {flow.name}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Trigger: {flow.trigger}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${flow.state === 'Running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {flow.state}
                </span>
                <button
                  onClick={() => toggleFlow(flow.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  {flow.state === 'Running' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {flow.state === 'Running' ? 'Pause' : 'Start'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {flow.actions.map((action) => (
                <div key={action} className="text-xs bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-violet-800 inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {action}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Runs today: {flow.runsToday}</span>
              <span className="inline-flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Outcome target: +12% close rate</span>
              <span className="inline-flex items-center gap-1"><Send className="w-3.5 h-3.5" /> Multi-channel auto actions</span>
            </div>
          </article>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm inline-flex items-start gap-2">
        <Bell className="w-4 h-4 mt-0.5" />
        Workflow safety rule: avoid sending more than 2 outbound touches per lead in 24 hours.
      </div>
    </div>
  );
}
