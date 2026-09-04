import { useState, useEffect } from 'react';
import { Camera, MapPin, CheckCircle, Clock, AlertTriangle, Laptop, Home, Briefcase, FileText, Coffee } from 'lucide-react';
import TaskUploader from './field-ops/TaskUploader';

// Mock Data
const mockCampaigns = [
  { id: '1', name: 'Summer Retail Visibility Drive', location: 'Delhi NCR (14 Stores)', progress: 75, status: 'Active' },
  { id: '2', name: 'West Zone POSM Store Revamp', location: 'Mumbai & Pune (8 Stores)', progress: 100, status: 'Completed' },
  { id: '3', name: 'South India Supermarket Merchandising', location: 'Bengaluru (12 Stores)', progress: 40, status: 'Active' },
];

const mockTasks = [
  { id: 't1', title: 'Install Retail Front Display Banner', location: 'Store #45 - Connaught Place, Delhi', status: 'Pending', assignee: 'Pranav Singhal' },
  { id: 't2', title: 'Verify FMCG Shelf Placement & Stock Depth', location: 'Store #12 - Sector 18, Noida', status: 'Completed', assignee: 'Pranav Singhal', compliance: 98 },
  { id: 't3', title: 'Update Smart POS QR Terminal & Scanner', location: 'Store #88 - Cyber Hub, Gurgaon', status: 'Completed', assignee: 'Sneha Kapoor', compliance: 94 },
  { id: 't4', title: 'Retail Cooler Brand Sticker Placement', location: 'Store #104 - Indiranagar, Bengaluru', status: 'Failed', assignee: 'Karan Malhotra', compliance: 45 },
];

const DAYS_OF_WEEK = [
  { label: 'M', day: 'Mon', active: false },
  { label: 'T', day: 'Tue', active: false },
  { label: 'W', day: 'Wed', active: false },
  { label: 'T', day: 'Thu', active: false },
  { label: 'F', day: 'Fri', active: true },
  { label: 'S', day: 'Sat', active: false },
  { label: 'S', day: 'Sun', active: false },
];

const MONTHS = ['AUG', 'JUL', 'JUN', 'MAY', 'APR', 'MAR', 'FEB'];

export default function FieldOps() {
  const [activeTab, setActiveTab] = useState<'Attendance' | 'Tasks' | 'Campaigns'>('Attendance');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [complianceNotice, setComplianceNotice] = useState('');
  const [clockedIn, setClockedIn] = useState(true);
  const [activeMonth, setActiveMonth] = useState('AUG');
  const [is24Hour, setIs24Hour] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('en-US', {
      hour12: !is24Hour,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const pendingTasks = mockTasks.filter((t) => t.status === 'Pending').length;

  return (
    <div className="page-stack">
      {/* Verdict from the last visual compliance check. Only ever set from a
          real analysis result, so a failed AI call shows nothing here. */}
      {complianceNotice && (
        <div
          role="status"
          className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl"
        >
          <span className="text-sm text-blue-800 flex-1">{complianceNotice}</span>
          <button
            onClick={() => setComplianceNotice('')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ═══ KEKA-STYLE SUB-NAV HEADER ════════════════════════ */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-xl flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
            📍
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Field Force Operations & Attendance</h1>
            <p className="text-xs text-slate-400">Geo-tracking, shift attendance & AI visual merchandising compliance</p>
          </div>
        </div>

        {/* Sub-Nav Pills */}
        <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          {(['Attendance', 'Tasks', 'Campaigns'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab} {tab === 'Tasks' && `(${pendingTasks})`}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ KEKA-STYLE ATTENDANCE STATS & TIMINGS ════════════ */}
      {activeTab === 'Attendance' && (
        <div className="space-y-6">
          {/* Three Column Attendance Header Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ── 1. Attendance Stats ── */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-200">Attendance Stats</h2>
                  <span className="text-xs text-slate-400 font-semibold bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                    This Week
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center font-bold text-slate-950 text-xs">
                        PS
                      </div>
                      <span className="text-sm font-semibold text-slate-300">Me (Pranav)</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">AVG HRS / DAY</p>
                      <p className="text-base font-bold text-white font-mono">8h 45m</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">ON TIME ARRIVAL</p>
                      <p className="text-base font-bold text-emerald-400 font-mono">100%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                        👥
                      </div>
                      <span className="text-sm font-semibold text-slate-300">Field Team</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">AVG HRS / DAY</p>
                      <p className="text-base font-bold text-white font-mono">7h 32m</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">ON TIME ARRIVAL</p>
                      <p className="text-base font-bold text-cyan-400 font-mono">92%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 2. Timings & Shift Progress Bar ── */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-200 mb-3">Shift Timings</h2>

                {/* Day of week bubbles */}
                <div className="flex items-center gap-2 mb-5">
                  {DAYS_OF_WEEK.map((d, i) => (
                    <div
                      key={i}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        d.active
                          ? 'bg-cyan-400 text-slate-950 shadow-md ring-2 ring-cyan-300/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {d.label}
                    </div>
                  ))}
                </div>

                {/* Today's shift timing */}
                <p className="text-xs text-slate-400 font-semibold mb-2">Today (10:00 AM - 7:00 PM)</p>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2 border border-slate-700">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full" style={{ width: '68%' }} />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Duration: 9h 0m</span>
                  <span className="flex items-center gap-1">
                    <Coffee size={12} className="text-amber-400" /> 60 min break
                  </span>
                </div>
              </div>
            </div>

            {/* ── 3. Actions Panel ── */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-200">Field Actions</h2>
                  <div className="text-right">
                    <span className="text-base font-bold font-mono text-cyan-400 tracking-wider">
                      {formatTime(currentTime)}
                    </span>
                    <p className="text-[10px] text-slate-400">{formatDate(currentTime)}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => setClockedIn(!clockedIn)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-semibold ${
                      clockedIn
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Laptop size={14} /> {clockedIn ? 'Clocked In (Since 09:58 AM)' : 'Remote Clock-In'}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${clockedIn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  </button>

                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 font-semibold transition-colors">
                    <Home size={14} /> Work From Home / Remote
                  </button>

                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 font-semibold transition-colors">
                    <Briefcase size={14} /> On Duty Store Audit Check-in
                  </button>

                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 font-semibold transition-colors">
                    <FileText size={14} /> Field Attendance & TA/DA Policy
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ LOGS & MONTH SELECTOR STRIP ══════════════════ */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold text-slate-200">Logs & Requests</h2>
                <div className="flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold">
                    Attendance Log
                  </button>
                  <button className="px-3 py-1 text-slate-400 hover:text-white text-xs font-semibold">
                    Calendar View
                  </button>
                  <button className="px-3 py-1 text-slate-400 hover:text-white text-xs font-semibold">
                    Field Store Requests
                  </button>
                </div>
              </div>

              {/* 24-hour switch */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>24 hour format</span>
                <button
                  onClick={() => setIs24Hour(!is24Hour)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${is24Hour ? 'bg-purple-600' : 'bg-slate-700'}`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-all ${
                      is24Hour ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Month Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h3 className="text-base font-bold text-white">August, 2026</h3>
              <div className="flex items-center gap-1">
                {MONTHS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setActiveMonth(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeMonth === m
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Attendance Table Summary */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs">
              {['MON (24)', 'TUE (25)', 'WED (26)', 'THU (27)', 'FRI (28)', 'SAT (29)', 'SUN (30)'].map((col, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border ${
                    i === 4
                      ? 'bg-purple-950/40 border-purple-500/50 text-white'
                      : i >= 5
                      ? 'bg-slate-800/30 border-slate-800 text-slate-500'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase">{col}</p>
                  <p className="text-xs font-mono font-bold mt-1">{i >= 5 ? 'Weekly Off' : '8h 30m'}</p>
                  <span className={`inline-block w-2 h-2 rounded-full mt-2 ${i >= 5 ? 'bg-slate-600' : 'bg-emerald-400'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TASKS VIEW ═══════════════════════════════════════ */}
      {activeTab === 'Tasks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {mockTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-2xl shadow-2xs border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-all"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-sm text-slate-900">{task.title}</h3>
                  {task.status === 'Completed' && <CheckCircle size={18} className="text-emerald-500" />}
                  {task.status === 'Pending' && <Clock size={18} className="text-amber-500" />}
                  {task.status === 'Failed' && <AlertTriangle size={18} className="text-red-500" />}
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                  <MapPin size={13} className="text-blue-600" /> {task.location}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                {task.status === 'Pending' ? (
                  <button
                    onClick={() => setSelectedTask(task.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-xs font-bold transition-colors shadow-sm"
                  >
                    <Camera size={15} /> Execute & Upload Store Audit
                  </button>
                ) : (
                  <div className="w-full flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">Gemini Visual Compliance:</span>
                    <span
                      className={`font-bold font-mono px-2 py-0.5 rounded-md ${
                        task.compliance && task.compliance > 80
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {task.compliance}% Score
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ CAMPAIGNS VIEW ═══════════════════════════════════ */}
      {activeTab === 'Campaigns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {mockCampaigns.map((camp) => (
            <div key={camp.id} className="bg-white rounded-2xl shadow-2xs border border-slate-200 p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-base text-slate-900">{camp.name}</h3>
                <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  {camp.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                <MapPin size={14} className="text-blue-600" /> {camp.location}
              </p>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1 text-slate-600">
                  <span>Campaign Store Coverage</span>
                  <span className="font-bold font-mono">{camp.progress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${camp.progress}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Uploader Modal */}
      {selectedTask && (
        <TaskUploader
          taskId={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSuccess={(result) => {
            setComplianceNotice(
              result.passed
                ? `Verified: ${result.feedback}`
                : `Rejected: ${result.feedback}`
            );
          }}
        />
      )}
    </div>
  );
}
