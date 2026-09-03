import { BarChart3, TrendingUp, Clock, Heart, MessageCircle, Repeat2, Eye } from 'lucide-react';
import { PLATFORM_ANALYTICS, FILTERS, MAX_FOLLOWERS } from './types';
import type { FeedPost, FeedFilter } from './types';
import { PlatformIcon } from './shared';
import { PLATFORM_CONFIG } from './platforms';

interface PostAnalyticsProps {
  feedFilter: FeedFilter;
  setFeedFilter: (f: FeedFilter) => void;
  visiblePosts: FeedPost[];
}

export default function PostAnalytics({ feedFilter, setFeedFilter, visiblePosts }: PostAnalyticsProps) {
  return (
    <div className="flex flex-col gap-4">
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
    </div>
  );
}
