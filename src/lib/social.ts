import { api } from './api';

/**
 * Client for social channel connections and publishing.
 *
 * The shapes here mirror what the server reports, including the parts that say
 * a platform is *not* usable. That matters: the screen this replaces rendered a
 * green "Connected" dot for seven services from a hardcoded array.
 */

export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'x' | 'whatsapp';

export type ConnectionStatus = 'Connected' | 'Expired' | 'Revoked' | 'Error';

export type PostStatus =
  | 'Draft'
  | 'Scheduled'
  | 'Publishing'
  | 'Published'
  | 'PartiallyPublished'
  | 'Failed'
  | 'Canceled';

export interface PlatformCapabilities {
  text: boolean;
  image: boolean;
  imageRequired: boolean;
  maxChars: number | null;
  messaging: boolean;
}

export interface SocialConnection {
  id: string;
  platform: SocialPlatform;
  label: string;
  handle: string;
  avatarUrl?: string;
  status: ConnectionStatus;
  statusDetail: string | null;
  scopes: string[];
  isDefault: boolean;
  capabilities: PlatformCapabilities;
  expiresAt: string | null;
  expiringSoon: boolean;
  lastPublishAt: string | null;
  connectedAt: string;
}

export interface SocialProvider {
  platform: SocialPlatform;
  label: string;
  description: string;
  scopes: string[];
  capabilities: PlatformCapabilities;
  /** False when this server holds no client credentials for the platform. */
  configured: boolean;
  /** Which env vars an operator still has to set. */
  missingEnv: string[];
  /** Provider-side setup the credentials alone do not cover. */
  setupNote?: string;
  redirectUri: string;
  connections: SocialConnection[];
  connectedCount: number;
}

export interface PostTarget {
  id: string;
  platform: SocialPlatform;
  handle: string;
  status: PostStatus;
  permalink?: string | null;
  error?: string | null;
}

export interface SocialPost {
  id: string;
  body: string;
  hasMedia: boolean;
  status: PostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  targets: PostTarget[];
}

export const socialApi = {
  providers: () =>
    api.get<{ data: SocialProvider[]; encryptionAvailable: boolean }>('/social/providers'),

  connections: () =>
    api.get<{ data: SocialConnection[] }>('/social/connections').then((r) => r.data),

  /** Returns the provider consent URL for the browser to navigate to. */
  startConnect: (platform: SocialPlatform) =>
    api.post<{ authorizeUrl: string }>(`/social/connect/${platform}`),

  disconnect: (id: string) => api.delete<void>(`/social/connections/${id}`),

  setDefault: (id: string) => api.put<SocialConnection>(`/social/connections/${id}/default`),

  verify: (id: string) => api.post<SocialConnection>(`/social/connections/${id}/verify`),

  posts: (status?: PostStatus) =>
    api
      .get<{ data: SocialPost[] }>('/social/posts', { query: { limit: 50, status } })
      .then((r) => r.data),

  createPost: (input: {
    body: string;
    mediaUrl?: string;
    mediaMime?: string;
    connectionIds: string[];
    scheduledAt?: string;
  }) => api.post<SocialPost>('/social/posts', input),

  publishPost: (id: string) => api.post<SocialPost>(`/social/posts/${id}/publish`),

  cancelPost: (id: string) => api.delete<void>(`/social/posts/${id}`),

  runDue: () => api.post<{ processed: number }>('/social/posts/run-due'),
};

/** Brand tokens, keyed by the server's platform ids. */
export const PLATFORM_BRAND: Record<
  SocialPlatform,
  { short: string; iconBg: string; ring: string; text: string }
> = {
  instagram: {
    short: 'IG',
    iconBg: 'bg-gradient-to-br from-pink-500 to-orange-400',
    ring: 'border-pink-500 bg-pink-50',
    text: 'text-pink-600',
  },
  facebook: {
    short: 'FB',
    iconBg: 'bg-[#1877F2]',
    ring: 'border-blue-500 bg-blue-50',
    text: 'text-blue-600',
  },
  linkedin: {
    short: 'LI',
    iconBg: 'bg-[#0A66C2]',
    ring: 'border-sky-600 bg-sky-50',
    text: 'text-sky-700',
  },
  x: {
    short: 'X',
    iconBg: 'bg-slate-900',
    ring: 'border-slate-700 bg-slate-100',
    text: 'text-slate-800',
  },
  whatsapp: {
    short: 'WA',
    iconBg: 'bg-[#25D366]',
    ring: 'border-green-500 bg-green-50',
    text: 'text-green-600',
  },
};

export const STATUS_TONE: Record<ConnectionStatus, string> = {
  Connected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Expired: 'bg-amber-50 text-amber-700 border-amber-200',
  Revoked: 'bg-red-50 text-red-700 border-red-200',
  Error: 'bg-red-50 text-red-700 border-red-200',
};

export const POST_STATUS_TONE: Record<PostStatus, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  Publishing: 'bg-blue-50 text-blue-700 border-blue-200',
  Published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PartiallyPublished: 'bg-amber-50 text-amber-700 border-amber-200',
  Failed: 'bg-red-50 text-red-700 border-red-200',
  Canceled: 'bg-slate-100 text-slate-500 border-slate-200',
};

/**
 * Reads the outcome the OAuth callback appended to the URL, so the settings
 * screen can report what happened after the round trip, then clears it so a
 * refresh does not repeat the message.
 */
export function readOAuthOutcome(): { ok?: string; accounts?: number; error?: string } | null {
  const params = new URLSearchParams(window.location.search);
  const connected = params.get('social_connected');
  const error = params.get('social_error');
  const platform = params.get('social_platform');

  if (!connected && !error) return null;

  const clean = new URL(window.location.href);
  for (const key of ['social_connected', 'social_error', 'social_platform', 'social_accounts']) {
    clean.searchParams.delete(key);
  }
  window.history.replaceState({}, '', clean.toString());

  if (error) return { error: platform ? `${platform}: ${error}` : error };

  return {
    ok: connected ?? undefined,
    accounts: Number(params.get('social_accounts') ?? '0') || undefined,
  };
}
