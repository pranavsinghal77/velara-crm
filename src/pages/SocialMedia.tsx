import { useState, useMemo } from 'react';
import { Share2, Plus, Users, Heart, FileText, Sparkles, TrendingUp } from 'lucide-react';

import PostCreator from './social/PostCreator';
import ContentCalendar from './social/ContentCalendar';
import PostAnalytics from './social/PostAnalytics';
import TrendingIdeas from './social/TrendingIdeas';

import { SCHEDULED_POSTS, FEED_POSTS, MARCH_START_OFFSET, MARCH_DAYS } from './social/types';
import type { Platform, FeedFilter, ScheduledPost } from './social/types';
import { PLATFORM_CONFIG } from './social/shared';

export default function SocialMedia() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['IG', 'FB', 'LI']);
  const [topic, setTopic] = useState('');
  const [postSuccess, setPostSuccess] = useState('');

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedDate, setSchedDate] = useState('2026-03-12');
  const [schedTime, setSchedTime] = useState('10:00');
  const [schedConfirmed, setSchedConfirmed] = useState('');

  const [feedFilter, setFeedFilter] = useState<FeedFilter>('All');
  const [scheduledList, setScheduledList] = useState<ScheduledPost[]>(SCHEDULED_POSTS);

  const [calMonth] = useState('March 2026');

  const visiblePosts = useMemo(() =>
    feedFilter === 'All' ? FEED_POSTS : FEED_POSTS.filter((p) => p.platform === feedFilter),
    [feedFilter],
  );

  function togglePlatform(p: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function handlePostNow() {
    const names = selectedPlatforms.map((p) => PLATFORM_CONFIG[p].label).join(', ');
    setPostSuccess(`✅ Posted to ${names}!`);
    setTimeout(() => setPostSuccess(''), 3000);
  }

  function handleScheduleConfirm() {
    const d = new Date(schedDate + 'T' + schedTime);
    const label = d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    setSchedConfirmed(`✅ Scheduled for ${label}`);
    setTimeout(() => { setSchedConfirmed(''); setShowScheduleModal(false); }, 2000);
  }

  function deleteScheduled(id: string) { setScheduledList((prev) => prev.filter((s) => s.id !== id)); }

  const calCells = useMemo(() => {
    const cells: Array<number | null> = Array(MARCH_START_OFFSET).fill(null);
    for (let d = 1; d <= MARCH_DAYS; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, []);

  return (
    <div className="space-y-6">
      {/* ═══ SECTION 1 — HEADER ═════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">Social Media Manager</h1>
            <p className="text-gray-500 text-sm">AI-powered content creation, scheduling & analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {([
              { p: 'IG' as Platform, label: 'Instagram', pill: 'bg-pink-50 border-pink-200 text-pink-700',    dot: 'bg-pink-500'    },
              { p: 'LI' as Platform, label: 'LinkedIn',  pill: 'bg-blue-50 border-blue-200 text-blue-700',    dot: 'bg-blue-500'    },
              { p: 'FB' as Platform, label: 'Facebook',  pill: 'bg-indigo-50 border-indigo-200 text-indigo-700', dot: 'bg-indigo-500' },
              { p: 'X'  as Platform, label: 'X',         pill: 'bg-gray-50 border-gray-300 text-gray-700',    dot: 'bg-gray-800'    },
              { p: 'WA' as Platform, label: 'WhatsApp',  pill: 'bg-green-50 border-green-200 text-green-700', dot: 'bg-green-500'   },
            ]).map((c) => (
              <div key={c.p} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${c.pill}`}>
                <div className={`w-2 h-2 ${c.dot} rounded-full`} />
                {c.label}
              </div>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            Create Post
          </button>
        </div>
      </div>

      {/* ═══ SECTION 2 — STATS ROW ══════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {([
          { label: 'Total Followers',   value: '12.4K', Icon: Users,      bg: 'bg-blue-50',   ic: 'text-blue-600',   sub: '+234 this week'       },
          { label: 'Avg Engagement',    value: '4.8%',  Icon: Heart,      bg: 'bg-pink-50',   ic: 'text-pink-600',   sub: 'Above industry avg'   },
          { label: 'Posts This Month',  value: '18',    Icon: FileText,   bg: 'bg-amber-50',  ic: 'text-amber-600',  sub: '6 scheduled'           },
          { label: 'AI Generated',      value: '12',    Icon: Sparkles,   bg: 'bg-purple-50', ic: 'text-purple-600', sub: '67% of all posts'      },
          { label: 'Total Reach',       value: '48.2K', Icon: TrendingUp, bg: 'bg-green-50',  ic: 'text-green-600',  sub: '+18% vs last month'    },
        ]).map((c) => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                <c.Icon className={`w-5 h-5 ${c.ic}`} />
              </div>
            </div>
            <p className="text-xs text-green-600">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ═══ SECTION 3 — MAIN GRID ══════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── LEFT: AI POST CREATOR lg:col-span-5 ─────────── */}
        <div className="lg:col-span-5">
          <PostCreator
            selectedPlatforms={selectedPlatforms}
            togglePlatform={togglePlatform}
            topic={topic}
            setTopic={setTopic}
            handlePostNow={handlePostNow}
            setShowScheduleModal={setShowScheduleModal}
            postSuccess={postSuccess}
          />
        </div>

        {/* ─── MIDDLE: CALENDAR + SCHEDULED lg:col-span-4 ──── */}
        <div className="lg:col-span-4">
          <ContentCalendar
            scheduledList={scheduledList}
            deleteScheduled={deleteScheduled}
            calMonth={calMonth}
            calCells={calCells}
            showScheduleModal={showScheduleModal}
            setShowScheduleModal={setShowScheduleModal}
            schedDate={schedDate}
            setSchedDate={setSchedDate}
            schedTime={schedTime}
            setSchedTime={setSchedTime}
            schedConfirmed={schedConfirmed}
            handleScheduleConfirm={handleScheduleConfirm}
            selectedPlatforms={selectedPlatforms}
          />
        </div>

        {/* ─── RIGHT: ANALYTICS + INSIGHTS lg:col-span-3 ──── */}
        <div className="lg:col-span-3 flex flex-col gap-0">
          <PostAnalytics
            feedFilter={feedFilter}
            setFeedFilter={setFeedFilter}
            visiblePosts={visiblePosts}
          />
          <TrendingIdeas
            setTopic={setTopic}
            handlePostNow={handlePostNow}
          />
        </div>
      </div>
    </div>
  );
}
