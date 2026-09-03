import { useState } from 'react';

import { Sparkles, Copy, RefreshCw, X, Zap, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TONES, LANGS, QUICK_TOPICS, DEFAULT_HASHTAGS, GENERATED_CAPTION } from './types';
import type { Tone, Language } from './types';
import { PLATFORM_BRAND, type SocialConnection } from '../../lib/social';

interface PostCreatorProps {
  /** Accounts with a live grant. A post targets accounts, not platforms. */
  connections: SocialConnection[];
  selectedIds: string[];
  toggleConnection: (id: string) => void;
  topic: string;
  setTopic: (t: string) => void;
  /** Publishes the caption to the selected accounts. */
  onPublish: (caption: string) => Promise<void>;
  onSchedule: (caption: string) => void;
  isPublishing: boolean;
  postSuccess: string;
  postError: string;
}

export default function PostCreator({
  connections,
  selectedIds,
  toggleConnection,
  topic,
  setTopic,
  onPublish,
  onSchedule,
  isPublishing,
  postSuccess,
  postError,
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

  // The binding limit is the tightest one among the accounts actually
  // selected, read from the capabilities the server reports rather than
  // hardcoded per platform here.
  const selected = connections.filter((c) => selectedIds.includes(c.id));
  const tightest = selected
    .map((c) => ({ label: c.label, max: c.capabilities.maxChars }))
    .filter((c): c is { label: string; max: number } => typeof c.max === 'number')
    .sort((a, b) => a.max - b.max)[0];

  const overLimit = tightest ? charCount > tightest.max : false;
  const charWarning = tightest && overLimit
    ? `Over the ${tightest.label} limit (${tightest.max})`
    : null;

  // Instagram has no text-only post type, so say so before the attempt rather
  // than letting the provider reject it.
  const needsImage = selected.filter((c) => c.capabilities.imageRequired);
  const blockedReason =
    selected.length === 0
      ? 'Choose at least one account'
      : charWarning
        ? charWarning
        : needsImage.length > 0
          ? `${needsImage.map((c) => c.label).join(', ')} requires an image, which this composer cannot attach yet`
          : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Card header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white" />
          <span className="text-white font-bold">AI Post Creator</span>
        </div>
        <p className="text-purple-200 text-xs mt-0.5">Generate engaging content in seconds</p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Account selector. Only accounts with a live grant appear here, so
            there is no way to aim a post at a platform that is not connected. */}
        <div>
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5">Post to</p>

          {connections.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-lg p-4 text-center">
              <p className="text-xs text-slate-500">No social accounts are connected yet.</p>
              <Link
                to="/settings"
                className="inline-block mt-2 text-xs font-semibold text-blue-600 hover:underline"
              >
                Connect an account in Settings
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connections.map((conn) => {
                const brand = PLATFORM_BRAND[conn.platform];
                const active = selectedIds.includes(conn.id);
                const usable = conn.status === 'Connected' && !conn.capabilities.messaging;

                return (
                  <button
                    key={conn.id}
                    onClick={() => usable && toggleConnection(conn.id)}
                    disabled={!usable}
                    title={
                      conn.capabilities.messaging
                        ? `${conn.label} is a messaging channel, not a feed`
                        : conn.status !== 'Connected'
                          ? `${conn.handle} needs reconnecting`
                          : conn.handle
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${
                      !usable
                        ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                        : active
                          ? `${brand.ring} ${brand.text}`
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full ${usable ? brand.iconBg : 'bg-slate-200'} text-white text-[8px] font-bold flex items-center justify-center`}
                    >
                      {brand.short}
                    </span>
                    <span className="truncate max-w-[120px]">{conn.handle}</span>
                    {conn.status !== 'Connected' && (
                      <span className="text-[9px] font-semibold text-amber-600">{conn.status}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Topic textarea */}
        <div>
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">What's your post about?</p>
          <textarea
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Announcing our new AI lead scoring feature..."
            className="w-full border border-slate-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Quick topic pills */}
        <div>
          <p className="text-xs text-slate-500 mb-1.5">💡 Quick topics</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TOPICS.map((qt) => (
              <button
                key={qt}
                onClick={() => setTopic(qt)}
                className="px-2 py-1 bg-slate-100 rounded-md text-xs text-slate-600 cursor-pointer hover:bg-purple-100 hover:text-purple-700 transition-colors"
              >
                {qt}
              </button>
            ))}
          </div>
        </div>

        {/* Tone + Language */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
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
          <div className="flex flex-col gap-3 pt-1 border-t border-slate-100">
            {/* Caption box */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Generated Caption</span>
                <button onClick={copyCaption} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <textarea
                rows={7}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 resize-none outline-none leading-relaxed"
              />
            </div>

            {/* Hashtags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">AI Hashtags</span>
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
            <div className="flex justify-between text-xs text-slate-500">
              <span>Character count: {charCount}</span>
              {charWarning && <span className="text-amber-600 font-medium">{charWarning}</span>}
            </div>

            {/* Outcome of the real publish attempt, reported per account. */}
            {postSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-4 py-2.5 whitespace-pre-line">
                {postSuccess}
              </div>
            )}
            {postError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2.5 whitespace-pre-line"
              >
                {postError}
              </div>
            )}

            {/* Why the buttons are disabled, instead of a silent no-op. */}
            {blockedReason && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {blockedReason}
              </p>
            )}

            {/* Post Now / Schedule */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => void onPublish(caption)}
                disabled={Boolean(blockedReason) || isPublishing}
                className="py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {isPublishing ? 'Publishing...' : 'Post Now'}
              </button>
              <button
                onClick={() => onSchedule(caption)}
                disabled={Boolean(blockedReason) || isPublishing}
                className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
