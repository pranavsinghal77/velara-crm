import { useState } from 'react';
import { Play, Pause, Plus, Clock, Target, Bell, CheckCircle2, Zap } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

type FlowState = 'Running' | 'Paused';

type WorkflowItem = {
  id: string;
  name: string;
  trigger: string;
  triggerType: 'IndiaMART' | 'AI Score' | 'Status' | 'Inactivity';
  actions: string[];
  state: FlowState;
  runsToday: number;
  lastRun: string;
};

const baseFlows: WorkflowItem[] = [
  {
    id: 'wf-1',
    name: 'IndiaMART & JustDial Instant Welcome',
    trigger: 'New lead arrives from IndiaMART or JustDial',
    triggerType: 'IndiaMART',
    actions: ['Send WhatsApp Welcome & PDF Catalog', 'Assign to Sneha Kapoor via Round-Robin', 'Schedule First Call Task in 15 mins'],
    state: 'Running',
    runsToday: 14,
    lastRun: '12 mins ago',
  },
  {
    id: 'wf-2',
    name: 'Hot Lead Executive Escalation',
    trigger: 'AI conversion score >= 80 & no rep response for 4h',
    triggerType: 'AI Score',
    actions: ['Generate ZeroBT Escalation Dossier', 'Notify Sales Manager on WhatsApp', 'Tag Account as 🔥 High Intent VIP'],
    state: 'Running',
    runsToday: 8,
    lastRun: '45 mins ago',
  },
  {
    id: 'wf-3',
    name: 'Demo Completed Follow-up Sequence',
    trigger: 'Lead status moves to "Contacted" & Demo logged',
    triggerType: 'Status',
    actions: ['Send Case Study & GST Quotation Preview', 'Schedule 48h Decision Follow-up Call', 'Queue Rep Task for Pricing Discussion'],
    state: 'Running',
    runsToday: 6,
    lastRun: '2 hours ago',
  },
  {
    id: 'wf-4',
    name: 'Cold Lead Re-engagement Sprint',
    trigger: 'AI score < 50 and 14 days of no buyer activity',
    triggerType: 'Inactivity',
    actions: ['Enroll into 5-touch WhatsApp value campaign', 'Share 20% Annual Billing Offer', 'Delay Outbound Calls by 7 days'],
    state: 'Paused',
    runsToday: 0,
    lastRun: 'Yesterday',
  },
];

export default function Workflows() {
  const leads = useCrmStore((s) => s.leads);
  const [flows, setFlows] = useState<WorkflowItem[]>(baseFlows);
  const [notice, setNotice] = useState('');

  const running = flows.filter((flow) => flow.state === 'Running').length;
  const generatedActions = flows.reduce((sum, flow) => sum + flow.runsToday, 0) * 3;

  function toggleFlow(id: string) {
    setFlows((current) =>
      current.map((flow) => {
        if (flow.id === id) {
          const nextState = flow.state === 'Running' ? 'Paused' : 'Running';
          setNotice(`Workflow "${flow.name}" is now ${nextState}.`);
          return { ...flow, state: nextState };
        }
        return flow;
      })
    );
  }

  function runTestFlow(flowName: string) {
    setNotice(`Simulated test run triggered for "${flowName}". All 3 actions completed with 0 errors.`);
  }

  function createWorkflow() {
    const next: WorkflowItem = {
      id: `wf-${Date.now()}`,
      name: 'High-Value Lead Revival Sprint',
      trigger: 'Budget > ₹5L and no interaction for 7 days',
      triggerType: 'AI Score',
      actions: ['Queue personalized WhatsApp VIP opener', 'Alert Account Executive', 'Send ROI Case Study PDF'],
      state: 'Running',
      runsToday: 1,
      lastRun: 'Just now',
    };
    setFlows((current) => [next, ...current]);
    setNotice('New automated workflow created and started successfully.');
  }

  return (
    <div className="page-stack">
      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700 flex items-center justify-between shadow-2xs">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="hover:text-blue-900 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* ═══ HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Workflow Automation Studio</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
              {flows.length} Active Sequences
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Trigger-Action automated sequences across WhatsApp, VoIP, lead distribution & task queues.
          </p>
        </div>

        <button
          onClick={createWorkflow}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create New Workflow
        </button>
      </div>

      {/* ═══ STATS GRID ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Configured Sequences</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{flows.length} Workflows</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            <CheckCircle2 size={12} /> Real-time Trigger Listener
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Running Engines</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{running} Active</p>
          <p className="text-[11px] text-slate-400 font-semibold mt-2">Zero-downtime execution</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Automated Actions Today</p>
          <p className="text-2xl font-bold text-blue-700 mt-1 font-mono">{generatedActions} Executions</p>
          <p className="text-[11px] text-slate-400 font-semibold mt-2">Saves ~6.5 hrs of manual work</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Eligible Leads</p>
          <p className="text-2xl font-bold text-purple-700 mt-1 font-mono">{leads.length} Contacts</p>
          <p className="text-[11px] text-slate-400 font-semibold mt-2">Syncing with database</p>
        </div>
      </div>

      {/* ═══ WORKFLOW CARDS ═══════════════════════════════════ */}
      <div className="space-y-4">
        {flows.map((flow) => (
          <div
            key={flow.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md transition-all space-y-4"
          >
            {/* Header: Title, Trigger & Controls */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Zap size={16} />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{flow.name}</h3>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      flow.state === 'Running'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {flow.state}
                  </span>
                </div>

                <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                  <span className="font-bold text-slate-700">⚡ Trigger:</span> {flow.trigger}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => runTestFlow(flow.name)}
                  className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
                >
                  Test Run ⚡
                </button>
                <button
                  onClick={() => toggleFlow(flow.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                    flow.state === 'Running'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                  }`}
                >
                  {flow.state === 'Running' ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Start
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Visual Action Nodes Flow */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {flow.actions.map((action, i) => (
                <div
                  key={action}
                  className="text-xs bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-slate-800 flex items-start gap-2.5 font-medium shadow-2xs"
                >
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{action}</span>
                </div>
              ))}
            </div>

            {/* Footer Stats Strip */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-blue-500" /> Runs today:{' '}
                <strong className="text-slate-700 font-mono">{flow.runsToday}</strong> (Last: {flow.lastRun})
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <Target className="w-3.5 h-3.5 text-emerald-500" /> Target: +18% Pipeline Close Velocity
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Safety Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs flex items-start gap-2.5">
        <Bell className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
        <div>
          <span className="font-bold">Enterprise Cadence Protection:</span> Built-in safeguard automatically throttles
          automated WhatsApp and email messages to a maximum of 2 outbound touches per lead per 24-hour cycle.
        </div>
      </div>
    </div>
  );
}
