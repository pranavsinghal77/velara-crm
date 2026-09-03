import { useState } from 'react';

import { Sparkles, Copy, RefreshCw, X, Zap, Calendar } from 'lucide-react';
import { TONES, LANGS, PLATFORMS, QUICK_TOPICS, DEFAULT_HASHTAGS, GENERATED_CAPTION } from './types';
import type { Platform, Tone, Language } from './types';
import { PlatformIcon } from './shared';
import { PLATFORM_CONFIG } from './platforms';

interface PostCreatorProps {
  selectedPlatforms: Platform[];
  togglePlatform: (p: Platform) => void;
  topic: string;
  setTopic: (t: string) => void;
  handlePostNow: () => void;
  setShowScheduleModal: (s: boolean) => void;
  postSuccess: string;
}

export default function PostCreator({
  selectedPlatforms,
  togglePlatform,
  topic,
  setTopic,
  handlePostNow,
  setShowScheduleModal,
  postSuccess,
}: PostCreatorProps) {
  const [tone, setTone] = useState<Tone>('Professional');
  const [language, setLanguage] = useState<Language>('English');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [caption, setCaption] = useState(GENERATED_CAPTION);
  const [hashtags, setHashtags] = useState<string[]>(DEFAULT_HASHTAGS);

  function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
      setCaption(GENERATED_CAPTION);
      setHashtags(DEFAULT_HASHTAGS);
    }, 1500);
  }

  function removeHashtag(h: string) { setHashtags((prev) => prev.filter((x) => x !== h)); }
  function handleRegenerateHashtags() { setHashtags([...DEFAULT_HASHTAGS].reverse().slice(0, 8)); }
  function copyCaption() { void navigator.clipboard.writeText(caption); }

  const charCount = caption.length;
  const charWarning = selectedPlatforms.includes('X') && charCount > 280
    ? '⚠️ Over X limit (280)'
    : selectedPlatforms.includes('IG') && charCount > 2200
      ? '⚠️ Over Instagram limit (2200)'
      : null;

  return (
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
  );
}
