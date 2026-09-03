export type Platform = 'IG' | 'FB' | 'LI' | 'X' | 'WA';
export type Tone = 'Professional' | 'Creative' | 'Inspirational' | 'Urgent' | 'Humorous';
export type Language = 'English' | 'Hindi' | 'Hinglish';
export type FeedFilter = 'All' | 'IG' | 'FB' | 'LI' | 'X';

export interface ScheduledPost {
  id: string;
  preview: string;
  platforms: Platform[];
  date: string;
  time: string;
}

export interface FeedPost {
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

export const SCHEDULED_POSTS: ScheduledPost[] = [
  { id: 's1', preview: '🚀 Transform lead management with Velara AI...', platforms: ['IG', 'FB'],          date: 'Mar 12', time: '10:00 AM' },
  { id: 's2', preview: 'Client Success Story: How Kumar Enterprises…',   platforms: ['LI', 'X'],          date: 'Mar 13', time: '2:00 PM'  },
  { id: 's3', preview: 'New Feature Launch: AI scoring that predicts…',  platforms: ['IG','FB','LI','X'], date: 'Mar 15', time: '9:00 AM'  },
  { id: 's4', preview: 'Weekend Sales Tip: Always follow up within 2…',  platforms: ['IG', 'LI'],         date: 'Mar 16', time: '11:00 AM' },
];

export const FEED_POSTS: FeedPost[] = [
  { id: 'f1', platform: 'IG', ago: '2 days ago',  caption: '🚀 Transforming Indian businesses with Velara AI! Manage your leads like a pro — from JustDial to WhatsApp, we\'ve got you covered. #VelaraCRM #AI',         likes: 245, comments: 32, shares: 18, views: '1.2K', aiScore: 88, aiTip: 'Post at 2 PM for 20% more reach. Try adding a CTA to boost saves.' },
  { id: 'f2', platform: 'LI', ago: '4 days ago',  caption: '💡 78% of Indian SMEs lose leads due to poor follow-up. Velara auto-follows for you — 24/7. Book a demo! #SalesAutomation #IndiaStartup',                   likes: 312, comments: 47, shares: 29, views: '2.8K', aiScore: 94, aiTip: 'Posts with stats get 3x more impressions. Great use of data.' },
  { id: 'f3', platform: 'FB', ago: '5 days ago',  caption: '🎯 Our clients are closing deals 3x faster using Velara\'s AI Lead Score. Real results, real growth. #VelaraCRM #LeadManagement',                           likes: 189, comments: 21, shares: 14, views: '980',  aiScore: 76, aiTip: 'Add a CTA button to boost click-through rate by 15%.' },
  { id: 'f4', platform: 'X',  ago: '6 days ago',  caption: 'Velara CRM just hit 500+ active businesses 🔥 Thank you for trusting us with your sales. More features dropping soon. Stay tuned! #Milestone #CRM',           likes: 421, comments: 58, shares: 67, views: '4.1K', aiScore: 91, aiTip: 'High engagement — pin this post to maximise reach.' },
  { id: 'f5', platform: 'IG', ago: '8 days ago',  caption: '📊 Before Velara vs After Velara — the numbers speak for themselves. Swipe to see how our clients grew 60% in Q1. #BeforeAfter #Sales',                     likes: 533, comments: 74, shares: 42, views: '3.6K', aiScore: 96, aiTip: 'Carousel posts perform best on Instagram. Keep this format.' },
  { id: 'f6', platform: 'LI', ago: '10 days ago', caption: 'Excited to announce our new WhatsApp CRM integration! 📱 Now manage all WhatsApp leads directly inside Velara. DM for early access. #ProductLaunch',          likes: 278, comments: 39, shares: 31, views: '2.1K', aiScore: 83, aiTip: 'Product launch posts get high saves. Consider boosting this one.' },
];

export const PLATFORM_ANALYTICS = [
  { p: 'FB' as Platform,  label: 'Facebook',   followers: 3240, pct: 100, eng: '3.2%', bg: 'bg-indigo-500' },
  { p: 'IG' as Platform,  label: 'Instagram',  followers: 4200, pct: 100, eng: '6.8%', bg: 'bg-pink-500'   },
  { p: 'LI' as Platform,  label: 'LinkedIn',   followers: 2800, pct: 87,  eng: '4.1%', bg: 'bg-blue-600'   },
  { p: 'X' as Platform,   label: 'X (Twitter)',followers: 1760, pct: 54,  eng: '5.3%', bg: 'bg-slate-800'   },
  { p: 'WA' as Platform,  label: 'WhatsApp',   followers: 400,  pct: 12,  eng: '72%',  bg: 'bg-green-500'  },
];

export const MAX_FOLLOWERS = 4200;

export const AI_IDEAS = [
  { text: 'Share a behind-the-scenes video of your team using Velara to close a big deal.',      tag: 'Video Idea',   emoji: '🎬' },
  { text: "Create a 'Did you know?' post about JustDial & IndiaMART integration features.",       tag: 'Educational',  emoji: '💡' },
  { text: 'Host a LinkedIn Live Q&A about AI in sales for Indian SMEs.',                          tag: 'Live Session', emoji: '🎙️' },
  { text: 'Post a festive campaign for upcoming IPL season with your brand.',                     tag: 'Trending',     emoji: '🏏' },
  { text: 'Showcase a client testimonial with before/after revenue numbers in a carousel post.', tag: 'Social Proof', emoji: '📈' },
];

export const QUICK_TOPICS = [
  'New feature launch',
  'Client success story',
  'Sales tip for India',
  'Product demo invite',
  'Festive campaign 🎉',
];

export const DEFAULT_HASHTAGS = [
  '#VelaraCRM','#SalesAutomation','#IndianBusiness',
  '#StartupIndia','#CRM','#AI','#B2BSales',
  '#LeadManagement','#JustDial','#IndiaMART',
];

export const GENERATED_CAPTION = `🚀 Transform the way you manage leads!

Velara CRM is helping 500+ Indian businesses close deals faster with the power of AI.

Here's what our clients love:
✅ AI Lead Scoring — know your hottest leads instantly
✅ Unified WhatsApp + Email inbox
✅ Automated follow-ups that never miss a lead
✅ JustDial & IndiaMART native integration

Ready to 10x your sales? 👇
Drop a 'YES' in comments or DM us!

#VelaraCRM #SalesAutomation #IndianBusiness #StartupIndia #CRM #AI #B2BSales #LeadManagement`;

export const POST_DATES: Record<number, string> = {
  12: 'bg-pink-400',
  13: 'bg-blue-500',
  15: 'bg-purple-500',
  16: 'bg-pink-400',
  18: 'bg-blue-500',
  20: 'bg-indigo-500',
};

export const CAL_DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];
export const MARCH_START_OFFSET = 6;
export const MARCH_DAYS = 31;
export const TODAY = 11;

export const TONES: Tone[]     = ['Professional','Creative','Inspirational','Urgent','Humorous'];
export const LANGS: Language[] = ['English','Hindi','Hinglish'];
export const PLATFORMS: Platform[] = ['IG','FB','LI','X','WA'];
export const FILTERS: { label: string; val: FeedFilter }[] = [
  { label: 'All',       val: 'All' },
  { label: 'Instagram', val: 'IG'  },
  { label: 'Facebook',  val: 'FB'  },
  { label: 'LinkedIn',  val: 'LI'  },
  { label: 'X',         val: 'X'   },
];

