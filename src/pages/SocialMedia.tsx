import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Share2,
  Users,
} from 'lucide-react';
import { ApiError } from '../lib/api';
import { socialApi, type SocialConnection, type SocialPost } from '../lib/social';

import PostCreator from './social/PostCreator';
import ContentCalendar from './social/ContentCalendar';
import PostAnalytics from './social/PostAnalytics';
import TrendingIdeas from './social/TrendingIdeas';

import { SCHEDULED_POSTS, FEED_POSTS, MARCH_START_OFFSET, MARCH_DAYS } from './social/types';
import type { Platform, FeedFilter, ScheduledPost } from './social/types';

export default function SocialMedia() {
  // Connections are the source of truth for what can be posted to; the page no
  // longer assumes a fixed set of platforms is available.
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [postSuccess, setPostSuccess] = useState('');
  const [postError, setPostError] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedDate, setSchedDate] = useState('2026-03-12');
  const [schedTime, setSchedTime] = useState('10:00');
  const [schedConfirmed, setSchedConfirmed] = useState('');

  const [pendingCaption, setPendingCaption] = useState('');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('All');
  const [scheduledList, setScheduledList] = useState<ScheduledPost[]>(SCHEDULED_POSTS);

  const [calMonth] = useState('March 2026');

  const visiblePosts = useMemo(() =>
    feedFilter === 'All' ? FEED_POSTS : FEED_POSTS.filter((p) => p.platform === feedFilter),
    [feedFilter],
  );

  const load = useCallback(async () => {
    try {
      const [conns, existing] = await Promise.all([socialApi.connections(), socialApi.posts()]);
      setConnections(conns);
      setPosts(existing);
      setLoadError('');
      // Preselect the default target per platform, so the common case is one click.
      setSelectedIds((prev) =>
        prev.length > 0
          ? prev.filter((id) => conns.some((c) => c.id === id))
          : conns
              .filter((c) => c.isDefault && c.status === 'Connected' && !c.capabilities.messaging)
              .map((c) => c.id)
      );
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load social channels.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleConnection(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /**
   * Publishes for real and reports what each platform did.
   *
   * The previous handler set the string "Posted to Instagram, Facebook,
   * LinkedIn!" without calling anything. This one reads the per-target result
   * the server returns, so a partial success says which account failed and why.
   */
  async function handlePostNow(caption: string) {
    setIsPublishing(true);
    setPostSuccess('');
    setPostError('');

    try {
      const post = await socialApi.createPost({ body: caption, connectionIds: selectedIds });

      const ok = post.targets.filter((t) => t.status === 'Published');
      const failed = post.targets.filter((t) => t.status === 'Failed');

      if (ok.length > 0) {
        setPostSuccess(
          `Published to ${ok.map((t) => t.handle).join(', ')}.` +
            (failed.length > 0 ? '' : ' View it on the platform from the post history below.')
        );
      }
      if (failed.length > 0) {
        setPostError(
          failed.map((t) => `${t.handle}: ${t.error ?? 'failed'}`).join('\n')
        );
      }

      await load();
    } catch (err) {
      setPostError(err instanceof ApiError ? err.message : 'Could not publish the post.');
    } finally {
      setIsPublishing(false);
    }
  }

  function handleOpenSchedule(caption: string) {
    setPendingCaption(caption);
    setShowScheduleModal(true);
  }

  /** Schedules the post server-side so it survives a page close. */
  async function handleScheduleConfirm() {
    setIsPublishing(true);
    setPostError('');
    try {
      const when = new Date(`${schedDate}T${schedTime}`);
      await socialApi.createPost({
        body: pendingCaption,
        connectionIds: selectedIds,
        scheduledAt: when.toISOString(),
      });
      setSchedConfirmed(
        `Scheduled for ${when.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
      );
      await load();
      setTimeout(() => {
        setSchedConfirmed('');
        setShowScheduleModal(false);
      }, 1800);
    } catch (err) {
      setPostError(err instanceof ApiError ? err.message : 'Could not schedule the post.');
      setShowScheduleModal(false);
    } finally {
      setIsPublishing(false);
    }
  }

  function deleteScheduled(id: string) { setScheduledList((prev) => prev.filter((s) => s.id !== id)); }

  // Accounts that can actually receive a feed post.
  const postableConnections = useMemo(
    () => connections.filter((c) => !c.capabilities.messaging),
    [connections]
  );

  const connectedPlatformCount = useMemo(
    () => new Set(postableConnections.filter((c) => c.status === 'Connected').map((c) => c.platform)).size,
    [postableConnections]
  );

  const publishedCount = posts.filter(
    (p) => p.status === 'Published' || p.status === 'PartiallyPublished'
  ).length;
  const scheduledCount = posts.filter((p) => p.status === 'Scheduled').length;
  const attentionCount =
    posts.filter((p) => p.status === 'Failed' || p.status === 'PartiallyPublished').length +
    connections.filter((c) => c.status !== 'Connected').length;

  const selectedHandles = useMemo(
    () => connections.filter((c) => selectedIds.includes(c.id)).map((c) => c.handle),
    [connections, selectedIds]
  );

  const calCells = useMemo(() => {
    const cells: Array<number | null> = Array(MARCH_START_OFFSET).fill(null);
    for (let d = 1; d <= MARCH_DAYS; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, []);

  return (
    <div className="page-stack">
      {/* ═══ SECTION 1 — HEADER ═════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-slate-900">Social Media Manager</h1>
            <p className="text-slate-500 text-sm">AI-powered content creation, scheduling & analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {([
              { p: 'IG' as Platform, label: 'Instagram', pill: 'bg-pink-50 border-pink-200 text-pink-700',    dot: 'bg-pink-500'    },
              { p: 'LI' as Platform, label: 'LinkedIn',  pill: 'bg-blue-50 border-blue-200 text-blue-700',    dot: 'bg-blue-500'    },
              { p: 'FB' as Platform, label: 'Facebook',  pill: 'bg-indigo-50 border-indigo-200 text-indigo-700', dot: 'bg-indigo-500' },
              { p: 'X'  as Platform, label: 'X',         pill: 'bg-slate-50 border-slate-300 text-slate-700',    dot: 'bg-slate-800'    },
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

      {/* Connection state, and what to do about it. */}
      {loaded && loadError && (
        <div role="alert" className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="text-xs text-red-800">{loadError}</span>
        </div>
      )}

      {loaded && !loadError && postableConnections.length === 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">No publishing accounts connected</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Composing works, but nothing can be published until an account is linked. Connections
              are real OAuth grants on each platform.
            </p>
            <Link
              to="/settings"
              className="inline-block mt-2 text-xs font-semibold text-amber-900 underline"
            >
              Open Settings to connect an account
            </Link>
          </div>
        </div>
      )}

      {/* ═══ SECTION 2 — STATS ROW ══════════════════════════
          Counts of things this workspace actually has. The previous row showed
          invented figures (12.4K followers, 4.8% engagement, 48.2K reach);
          follower and reach numbers need per-platform insights calls, which
          are not wired up, so they are not shown rather than guessed. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: 'Connected accounts', value: String(postableConnections.length), Icon: Users,        bg: 'bg-blue-50',    ic: 'text-blue-600',    sub: `across ${connectedPlatformCount} platform${connectedPlatformCount === 1 ? '' : 's'}` },
          { label: 'Published',          value: String(publishedCount),             Icon: CheckCircle2, bg: 'bg-green-50',   ic: 'text-green-600',   sub: 'posts sent from Velara' },
          { label: 'Scheduled',          value: String(scheduledCount),             Icon: Clock,        bg: 'bg-amber-50',   ic: 'text-amber-600',   sub: 'waiting to publish' },
          { label: 'Needs attention',    value: String(attentionCount),             Icon: AlertTriangle, bg: 'bg-red-50',    ic: 'text-red-600',     sub: 'failed or expired' },
        ]).map((c) => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-2xl font-bold text-slate-900">{c.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
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
            connections={connections}
            selectedIds={selectedIds}
            toggleConnection={toggleConnection}
            topic={topic}
            setTopic={setTopic}
            onPublish={handlePostNow}
            onSchedule={handleOpenSchedule}
            isPublishing={isPublishing}
            postSuccess={postSuccess}
            postError={postError}
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
            selectedPlatforms={selectedHandles}
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
            onUseIdea={() => {
              setPostSuccess('');
              setPostError('');
            }}
          />
        </div>
      </div>
    </div>
  );
}
