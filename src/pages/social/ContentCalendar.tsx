import { Clock, CalendarDays, ChevronLeft, ChevronRight, Edit2, Trash2, X } from 'lucide-react';
import { POST_DATES, CAL_DAYS, TODAY } from './types';
import type { ScheduledPost } from './types';
import { PlatformBadge, PlatformIcon } from './shared';
import { PLATFORM_CONFIG } from './platforms';

interface ContentCalendarProps {
  scheduledList: ScheduledPost[];
  deleteScheduled: (id: string) => void;
  calMonth: string;
  calCells: Array<number | null>;
  showScheduleModal: boolean;
  setShowScheduleModal: (s: boolean) => void;
  schedDate: string;
  setSchedDate: (d: string) => void;
  schedTime: string;
  setSchedTime: (t: string) => void;
  schedConfirmed: string;
  handleScheduleConfirm: () => void | Promise<void>;
  /** Display names of the accounts the post will go to. */
  selectedPlatforms: string[];
}

export default function ContentCalendar({
  scheduledList,
  deleteScheduled,
  calMonth,
  calCells,
  showScheduleModal,
  setShowScheduleModal,
  schedDate,
  setSchedDate,
  schedTime,
  setSchedTime,
  schedConfirmed,
  handleScheduleConfirm,
  selectedPlatforms,
}: ContentCalendarProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Content Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Content Calendar</h3>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded hover:bg-slate-100 text-slate-400"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-semibold text-slate-700 px-1">{calMonth}</span>
            <button className="p-1 rounded hover:bg-slate-100 text-slate-400"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {CAL_DAYS.map((d) => (
            <div key={d} className="text-[10px] text-slate-400 text-center py-1 font-medium">{d}</div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-1">
          {calCells.map((date, i) => (
            <div
              key={i}
              className={`text-xs text-center py-1.5 rounded-lg cursor-pointer relative flex flex-col items-center ${
                date === null
                  ? ''
                  : date === TODAY
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              {date !== null && (
                <>
                  {date}
                  {POST_DATES[date] && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${POST_DATES[date]} ${date === TODAY ? 'bg-white' : ''}`} />
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {([
            { dot: 'bg-pink-400',   label: 'Instagram' },
            { dot: 'bg-indigo-500', label: 'Facebook' },
            { dot: 'bg-blue-500',   label: 'LinkedIn' },
            { dot: 'bg-purple-500', label: 'All platforms' },
          ]).map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${l.dot}`} />
              <span className="text-[10px] text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Posts */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">Scheduled Posts</h3>
            <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">sample data</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{scheduledList.length} upcoming</span>
        </div>

        {scheduledList.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">No scheduled posts</p>
        ) : (
          scheduledList.map((post) => (
            <div key={post.id} className="flex items-start gap-3 p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
              {/* Platform icon cluster */}
              <div className="flex -space-x-1 shrink-0 mt-0.5">
                {post.platforms.slice(0, 3).map((p) => (
                  <div key={p} className={`w-6 h-6 rounded-full ${PLATFORM_CONFIG[p].iconBg} flex items-center justify-center text-white border border-white`}>
                    <PlatformIcon p={p} size={10} />
                  </div>
                ))}
                {post.platforms.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[9px] font-bold border border-white">
                    +{post.platforms.length - 3}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <p className="text-sm text-slate-800 font-medium truncate">{post.preview}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {post.platforms.map((p) => <PlatformBadge key={p} p={p} />)}
                  <span className="text-xs text-slate-400 ml-1">{post.date}, {post.time}</span>
                </div>
              </div>

              <div className="flex gap-1 shrink-0">
                <button className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={() => deleteScheduled(post.id)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ═══ SCHEDULE MODAL ════════════════════════════════ */}
      {showScheduleModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overlay-enter"
          onClick={() => setShowScheduleModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-80 p-6 modal-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Schedule Post</h3>
              <button onClick={() => setShowScheduleModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Time</label>
                <input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-2.5 mb-4 flex items-center gap-2">
              <span className="text-xs text-slate-500">Posting to:</span>
              <div className="flex gap-1 flex-wrap">
                {selectedPlatforms.length === 0 ? (
                  <span className="text-xs text-slate-400">no accounts selected</span>
                ) : (
                  selectedPlatforms.map((name) => (
                    <span
                      key={name}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600"
                    >
                      {name}
                    </span>
                  ))
                )}
              </div>
            </div>

            {schedConfirmed ? (
              <div className="w-full py-2.5 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-lg text-center">
                {schedConfirmed}
              </div>
            ) : (
              <button
                onClick={handleScheduleConfirm}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Schedule Post
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
