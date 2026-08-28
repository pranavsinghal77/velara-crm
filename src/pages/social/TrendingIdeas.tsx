import { Lightbulb, Send, Zap } from 'lucide-react';
import { AI_IDEAS } from './types';

interface TrendingIdeasProps {
  setTopic: (t: string) => void;
  handlePostNow: () => void;
}

export default function TrendingIdeas({ setTopic, handlePostNow }: TrendingIdeasProps) {
  return (
    <div className="flex flex-col gap-4 mt-4">
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
  );
}
