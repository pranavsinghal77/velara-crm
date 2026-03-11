import { useState, useMemo } from 'react';
import {
  Share2,
  Plus,
  Users,
  Heart,
  FileText,
  Sparkles,
  TrendingUp,
  CalendarDays,
  BarChart3,
  Lightbulb,
  MessageCircle,
  Repeat2,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  Send,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Zap,
  Calendar,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
} from 'lucide-react';

// ─── types ────────────────────────────────────────────────────────────────────

type Platform = 'IG' | 'FB' | 'LI' | 'X' | 'WA';
type Tone = 'Professional' | 'Creative' | 'Inspirational' | 'Urgent' | 'Humorous';
type Language = 'English' | 'Hindi' | 'Hinglish';
type FeedFilter = 'All' | 'IG' | 'FB' | 'LI' | 'X';

interface ScheduledPost {
  id: string;
  preview: string;
  platforms: Platform[];
  date: string;
  time: string;
}

interface FeedPost {
  id: string;
  platform: Platform;
  ago: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  views: string;
  aiScore: number;
  aiTip: string;
}

// ─── mock data ────────────────────────────────────────────────────────────────

const SCHEDULED_POSTS: ScheduledPost[] = [
  { id: 's1', preview: '🚀 Transform lead management with Velara AI...', platforms: ['IG', 'FB'],          date: 'Mar 12', time: '10:00 AM' },
  { id: 's2', preview: 'Client Success Story: How Kumar Enterprises…',   platforms: ['LI', 'X'],          date: 'Mar 13', time: '2:00 PM'  },
  { id: 's3', preview: 'New Feature Launch: AI scoring that predicts…',  platforms: ['IG','FB','LI','X'], date: 'Mar 15', time: '9:00 AM'  },
  { id: 's4', preview: 'Weekend Sales Tip: Always follow up within 2…',  platforms: ['IG', 'LI'],         date: 'Mar 16', time: '11:00 AM' },
];

const FEED_POSTS: FeedPost[] = [
  { id: 'f1', platform: 'IG', ago: '2 days ago',  caption: '🚀 Transforming Indian businesses with Velara AI! Manage your leads like a pro — from JustDial to WhatsApp, we\'ve got you covered. #VelaraCRM #AI',         likes: 245, comments: 32, shares: 18, views: '1.2K', aiScore: 88, aiTip: 'Post at 2 PM for 20% more reach. Try adding a CTA to boost saves.' },
  { id: 'f2', platform: 'LI', ago: '4 days ago',  caption: '💡 78% of Indian SMEs lose leads due to poor follow-up. Velara auto-follows for you — 24/7. Book a demo! #SalesAutomation #IndiaStartup',                   likes: 312, comments: 47, shares: 29, views: '2.8K', aiScore: 94, aiTip: 'Posts with stats get 3x more impressions. Great use of data.' },
  { id: 'f3', platform: 'FB', ago: '5 days ago',  caption: '🎯 Our clients are closing deals 3x faster using Velara\'s AI Lead Score. Real results, real growth. #VelaraCRM #LeadManagement',                           likes: 189, comments: 21, shares: 14, views: '980',  aiScore: 76, aiTip: 'Add a CTA button to boost click-through rate by 15%.' },
  { id: 'f4', platform: 'X',  ago: '6 days ago',  caption: 'Velara CRM just hit 500+ active businesses 🔥 Thank you for trusting us with your sales. More features dropping soon. Stay tuned! #Milestone #CRM',           likes: 421, comments: 58, shares: 67, views: '4.1K', aiScore: 91, aiTip: 'High engagement — pin this post to maximise reach.' },
  { id: 'f5', platform: 'IG', ago: '8 days ago',  caption: '📊 Before Velara vs After Velara — the numbers speak for themselves. Swipe to see how our clients grew 60% in Q1. #BeforeAfter #Sales',                     likes: 533, comments: 74, shares: 42, views: '3.6K', aiScore: 96, aiTip: 'Carousel posts perform best on Instagram. Keep this format.' },
  { id: 'f6', platform: 'LI', ago: '10 days ago', caption: 'Excited to announce our new WhatsApp CRM integration! 📱 Now manage all WhatsApp leads directly inside Velara. DM for early access. #ProductLaunch',          likes: 278, comments: 39, shares: 31, views: '2.1K', aiScore: 83, aiTip: 'Product launch posts get high saves. Consider boosting this one.' },
];

const PLATFORM_ANALYTICS = [
  { p: 'FB' as Platform,  label: 'Facebook',   followers: 3240, pct: 100, eng: '3.2%', bg: 'bg-indigo-500' },
  { p: 'IG' as Platform,  label: 'Instagram',  followers: 4200, pct: 100, eng: '6.8%', bg: 'bg-pink-500'   },
  { p: 'LI' as Platform,  label: 'LinkedIn',   followers: 2800, pct: 87,  eng: '4.1%', bg: 'bg-blue-600'   },
  { p: 'X' as Platform,   label: 'X (Twitter)',followers: 1760, pct: 54,  eng: '5.3%', bg: 'bg-gray-800'   },
  { p: 'WA' as Platform,  label: 'WhatsApp',   followers: 400,  pct: 12,  eng: '72%',  bg: 'bg-green-500'  },
];

// platform follower max for bar %
const MAX_FOLLOWERS = 4200;

const AI_IDEAS = [
  { text: 'Share a behind-the-scenes video of your team using Velara to close a big deal.',      tag: 'Video Idea',   emoji: '🎬' },
  { text: "Create a 'Did you know?' post about JustDial & IndiaMART integration features.",       tag: 'Educational',  emoji: '💡' },
  { text: 'Host a LinkedIn Live Q&A about AI in sales for Indian SMEs.',                          tag: 'Live Session', emoji: '🎙️' },
  { text: 'Post a festive campaign for upcoming IPL season with your brand.',                     tag: 'Trending',     emoji: '🏏' },
  { text: 'Showcase a client testimonial with before/after revenue numbers in a carousel post.', tag: 'Social Proof', emoji: '📈' },
];

const QUICK_TOPICS = [
  'New feature launch',
  'Client success story',
  'Sales tip for India',
  'Product demo invite',
  'Festive campaign 🎉',
];

const DEFAULT_HASHTAGS = [
  '#VelaraCRM','#SalesAutomation','#IndianBusiness',
  '#StartupIndia','#CRM','#AI','#B2BSales',
  '#LeadManagement','#JustDial','#IndiaMART',
];

const GENERATED_CAPTION = `🚀 Transform the way you manage leads!

Velara CRM is helping 500+ Indian businesses close deals faster with the power of AI.

Here's what our clients love:
✅ AI Lead Scoring — know your hottest leads instantly
✅ Unified WhatsApp + Email inbox
✅ Automated follow-ups that never miss a lead
✅ JustDial & IndiaMART native integration

Ready to 10x your sales? 👇
Drop a 'YES' in comments or DM us!

#VelaraCRM #SalesAutomation #IndianBusiness #StartupIndia #CRM #AI #B2BSales #LeadManagement`;

// ─── calendar data ────────────────────────────────────────────────────────────

// dates with scheduled posts → dot color
const POST_DATES: Record<number, string> = {
  12: 'bg-pink-400',
  13: 'bg-blue-500',
  15: 'bg-purple-500',
  16: 'bg-pink-400',
  18: 'bg-blue-500',
  20: 'bg-indigo-500',
};

const CAL_DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];
// March 2026 starts on Sunday → offset 6 in Mon-first grid
// 1 March 2026 = Sunday, Monday-first grid offset = 6
const MARCH_START_OFFSET = 6;
const MARCH_DAYS = 31;

// ─── helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<Platform, { label: string; selectedCls: string; dotBg: string; iconBg: string }> = {
  IG: { label: 'Instagram', selectedCls: 'border-2 border-pink-500 bg-pink-50 text-pink-600',    dotBg: 'bg-pink-500',   iconBg: 'bg-gradient-to-br from-pink-500 to-orange-400' },
  FB: { label: 'Facebook',  selectedCls: 'border-2 border-indigo-500 bg-indigo-50 text-indigo-600', dotBg: 'bg-indigo-500', iconBg: 'bg-indigo-600' },
  LI: { label: 'LinkedIn',  selectedCls: 'border-2 border-blue-500 bg-blue-50 text-blue-600',    dotBg: 'bg-blue-500',   iconBg: 'bg-[#0A66C2]' },
  X:  { label: 'X',         selectedCls: 'border-2 border-gray-700 bg-gray-100 text-gray-800',   dotBg: 'bg-gray-800',   iconBg: 'bg-gray-900' },
  WA: { label: 'WhatsApp',  selectedCls: 'border-2 border-green-500 bg-green-50 text-green-600', dotBg: 'bg-green-500',  iconBg: 'bg-green-500' },
};

function PlatformIcon({ p, size = 12 }: { p: Platform; size?: number }) {
  if (p === 'IG') return <Instagram style={{ width: size, height: size }} />;
  if (p === 'FB') return <Facebook  style={{ width: size, height: size }} />;
  if (p === 'LI') return <Linkedin  style={{ width: size, height: size }} />;
  if (p === 'X')  return <Twitter   style={{ width: size, height: size }} />;
  // WhatsApp — use a simple circle with W
  return <span style={{ fontSize: size * 0.8, fontWeight: 700, lineHeight: 1 }}>W</span>;
}

function PlatformBadge({ p }: { p: Platform }) {
  const cfg = PLATFORM_CONFIG[p];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${cfg.iconBg}`}>
      <PlatformIcon p={p} size={9} />
      {p}
    </span>
  );
}

// ─── component ────────────────────────────────────────────────────────────────

export default function SocialMedia() {
  // creator state
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['IG', 'FB', 'LI']);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<Tone>('Professional');
  const [language, setLanguage] = useState<Language>('English');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [caption, setCaption] = useState(GENERATED_CAPTION);
  const [hashtags, setHashtags] = useState<string[]>(DEFAULT_HASHTAGS);
  const [postSuccess, setPostSuccess] = useState('');

  // schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedDate, setSchedDate] = useState('2026-03-12');
  const [schedTime, setSchedTime] = useState('10:00');
  const [schedConfirmed, setSchedConfirmed] = useState('');

  // history / feed state
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('All');
  const [scheduledList, setScheduledList] = useState<ScheduledPost[]>(SCHEDULED_POSTS);

  // calendar
  const [calMonth] = useState('March 2026');

  const visiblePosts = useMemo(() =>
    feedFilter === 'All' ? FEED_POSTS : FEED_POSTS.filter((p) => p.platform === feedFilter),
    [feedFilter],
  );

  const TONES: Tone[]     = ['Professional','Creative','Inspirational','Urgent','Humorous'];
  const LANGS: Language[] = ['English','Hindi','Hinglish'];
  const PLATFORMS: Platform[] = ['IG','FB','LI','X','WA'];
  const FILTERS: { label: string; val: FeedFilter }[] = [
    { label: 'All',       val: 'All' },
    { label: 'Instagram', val: 'IG'  },
    { label: 'Facebook',  val: 'FB'  },
    { label: 'LinkedIn',  val: 'LI'  },
    { label: 'X',         val: 'X'   },
  ];

  function togglePlatform(p: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => { setGenerating(false); setGenerated(true); setCaption(GENERATED_CAPTION); setHashtags(DEFAULT_HASHTAGS); }, 1500);
  }

  function removeHashtag(h: string) { setHashtags((prev) => prev.filter((x) => x !== h)); }
  function handleRegenerateHashtags() { setHashtags([...DEFAULT_HASHTAGS].reverse().slice(0, 8)); }

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

  function copyCaption() { void navigator.clipboard.writeText(caption); }

  const charCount = caption.length;
  const charWarning = selectedPlatforms.includes('X') && charCount > 280
    ? '⚠️ Over X limit (280)'
    : selectedPlatforms.includes('IG') && charCount > 2200
      ? '⚠️ Over Instagram limit (2200)'
      : null;

  // calendar cells
  const calCells = useMemo(() => {
    const cells: Array<number | null> = Array(MARCH_START_OFFSET).fill(null);
    for (let d = 1; d <= MARCH_DAYS; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, []);

  const TODAY = 11; // March 11, 2026

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
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Card header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-white font-bold">AI Post Creator</span>
              </div>
              <p className="text-purple-200 text-xs mt-0.5">Generate engaging content in seconds</p>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {/* Platform selector */}
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5">Post to</p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const cfg = PLATFORM_CONFIG[p];
                    const active = selectedPlatforms.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => togglePlatform(p)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          active
                            ? cfg.selectedCls
                            : 'border border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <PlatformIcon p={p} size={11} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Topic textarea */}
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">What's your post about?</p>
                <textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Announcing our new AI lead scoring feature..."
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 placeholder-gray-400"
                />
              </div>

              {/* Quick topic pills */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">💡 Quick topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TOPICS.map((qt) => (
                    <button
                      key={qt}
                      onClick={() => setTopic(qt)}
                      className="px-2 py-1 bg-gray-100 rounded-md text-xs text-gray-600 cursor-pointer hover:bg-purple-100 hover:text-purple-700 transition-colors"
                    >
                      {qt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone + Language */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as Tone)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    {TONES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    {LANGS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm disabled:opacity-60"
              >
                {generating ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI is writing...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate with AI</>
                )}
              </button>

              {/* Generated output */}
              {generated && (
                <div className="flex flex-col gap-3 pt-1 border-t border-gray-100">

                  {/* Caption box */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">Generated Caption</span>
                      <button onClick={copyCaption} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <textarea
                      rows={7}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="w-full bg-transparent text-sm text-gray-800 resize-none outline-none leading-relaxed"
                    />
                  </div>

                  {/* Hashtags */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">AI Hashtags</span>
                      <button onClick={handleRegenerateHashtags} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700">
                        <RefreshCw className="w-3 h-3" /> Regenerate
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {hashtags.map((h) => (
                        <span key={h} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-xs border border-blue-100">
                          {h}
                          <button onClick={() => removeHashtag(h)} className="hover:text-red-500 transition-colors">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Char counter */}
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Character count: {charCount}</span>
                    {charWarning && <span className="text-amber-600 font-medium">{charWarning}</span>}
                  </div>

                  {/* Post success toast */}
                  {postSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-lg px-4 py-2.5 text-center">
                      {postSuccess}
                    </div>
                  )}

                  {/* Post Now / Schedule */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handlePostNow}
                      className="py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Zap className="w-4 h-4" /> Post Now
                    </button>
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Calendar className="w-4 h-4" /> Schedule
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── MIDDLE: CALENDAR + SCHEDULED lg:col-span-4 ──── */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Content Calendar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            {/* Title bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">Content Calendar</h3>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1 rounded hover:bg-gray-100 text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-semibold text-gray-700 px-1">{calMonth}</span>
                <button className="p-1 rounded hover:bg-gray-100 text-gray-400"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {CAL_DAYS.map((d) => (
                <div key={d} className="text-[10px] text-gray-400 text-center py-1 font-medium">{d}</div>
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
                        : 'hover:bg-gray-100 text-gray-700'
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
                  <span className="text-[10px] text-gray-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scheduled Posts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900">Scheduled Posts</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{scheduledList.length} upcoming</span>
            </div>

            {scheduledList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No scheduled posts</p>
            ) : (
              scheduledList.map((post) => (
                <div key={post.id} className="flex items-start gap-3 p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  {/* Platform icon cluster */}
                  <div className="flex -space-x-1 shrink-0 mt-0.5">
                    {post.platforms.slice(0, 3).map((p) => (
                      <div key={p} className={`w-6 h-6 rounded-full ${PLATFORM_CONFIG[p].iconBg} flex items-center justify-center text-white border border-white`}>
                        <PlatformIcon p={p} size={10} />
                      </div>
                    ))}
                    {post.platforms.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-[9px] font-bold border border-white">
                        +{post.platforms.length - 3}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-sm text-gray-800 font-medium truncate">{post.preview}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {post.platforms.map((p) => <PlatformBadge key={p} p={p} />)}
                      <span className="text-xs text-gray-400 ml-1">{post.date}, {post.time}</span>
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => deleteScheduled(post.id)} className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── RIGHT: ANALYTICS + INSIGHTS lg:col-span-3 ──── */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* Platform Performance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">Platform Performance</h3>
            </div>
            <div className="space-y-3">
              {PLATFORM_ANALYTICS.map((row) => (
                <div key={row.p} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${PLATFORM_CONFIG[row.p].iconBg} flex items-center justify-center text-white shrink-0`}>
                    <PlatformIcon p={row.p} size={14} />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-800">{row.label}</span>
                      <span className="text-xs text-gray-500">{row.followers.toLocaleString()}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.bg}`}
                        style={{ width: `${Math.round((row.followers / MAX_FOLLOWERS) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    parseFloat(row.eng) >= 10 ? 'bg-green-100 text-green-700' :
                    parseFloat(row.eng) >= 5  ? 'bg-blue-100 text-blue-700'  :
                                                'bg-gray-100 text-gray-600'
                  }`}>
                    {row.eng}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Post Performance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">Recent Performance</h3>
              </div>
              {/* Filter pills */}
              <div className="flex gap-1 flex-wrap">
                {FILTERS.map((f) => (
                  <button
                    key={f.val}
                    onClick={() => setFeedFilter(f.val)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                      feedFilter === f.val
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[340px] overflow-y-auto">
              {visiblePosts.map((post) => (
                <div key={post.id} className="p-4 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-6 h-6 rounded-md ${PLATFORM_CONFIG[post.platform].iconBg} flex items-center justify-center text-white shrink-0`}>
                      <PlatformIcon p={post.platform} size={11} />
                    </div>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{post.ago}</span>
                    <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${post.aiScore >= 90 ? 'bg-green-100 text-green-700' : post.aiScore >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {post.aiScore}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed mb-2">{post.caption}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" />{post.likes}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3 text-blue-400" />{post.comments}</span>
                    <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3 text-green-400" />{post.shares}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-purple-400" />{post.views}</span>
                  </div>
                  <div className="mt-2 px-2 py-1.5 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-[10px] text-purple-700">✨ {post.aiTip}</p>
                  </div>
                </div>
              ))}
              {visiblePosts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">No posts for this platform</p>
              )}
            </div>
          </div>

          {/* AI Content Ideas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900">Trending Ideas</h3>
            </div>
            <div className="space-y-2">
              {AI_IDEAS.map((idea, i) => (
                <div key={i} className="flex items-start gap-2 bg-purple-50 rounded-lg p-2.5 border border-purple-100">
                  <span className="text-sm shrink-0 mt-0.5">{idea.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-700 leading-relaxed">{idea.text}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-700">{idea.tag}</span>
                      <button
                        onClick={() => setTopic(idea.text)}
                        className="text-[10px] font-semibold text-blue-600 hover:underline"
                      >
                        Use →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Send button for quick post */}
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-white" />
              <span className="text-white font-bold text-sm">Quick Send</span>
            </div>
            <p className="text-purple-200 text-xs">Post your last generated content instantly to all connected platforms.</p>
            <button
              onClick={handlePostNow}
              className="w-full py-2 bg-white text-purple-700 font-semibold text-sm rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" /> Post to All Platforms
            </button>
          </div>
        </div>
      </div>

      {/* ═══ SCHEDULE MODAL ════════════════════════════════ */}
      {showScheduleModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowScheduleModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-80 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Schedule Post</h3>
              <button onClick={() => setShowScheduleModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Date</label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Time</label>
                <input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-2.5 mb-4 flex items-center gap-2">
              <span className="text-xs text-gray-500">Posting to:</span>
              <div className="flex gap-1 flex-wrap">
                {selectedPlatforms.map((p) => <PlatformBadge key={p} p={p} />)}
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
