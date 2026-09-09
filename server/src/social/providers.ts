import { SocialPlatform } from '@prisma/client';
import { env } from '../config/env';

/**
 * What each platform needs to connect and to publish.
 *
 * Everything platform-specific lives here so the controller is one flow rather
 * than five. Crucially, `isConfigured` is computed from whether *this server*
 * actually holds the provider's client credentials — the previous Integrations
 * screen hardcoded `connected: true` for seven services that were wired to
 * nothing, and showed a green dot to prove it. A provider with no credentials
 * now reports itself as unavailable and says what is missing.
 *
 * Registering the OAuth apps is unavoidably a human step: each provider issues
 * client credentials against a named redirect URI, and Meta and X additionally
 * gate content-publishing permissions behind app review. The code below is
 * complete; it activates the moment the credentials are present.
 */

export interface PlatformCapabilities {
  /** Can publish text to a feed. */
  text: boolean;
  /** Can attach an image. */
  image: boolean;
  /** Requires an image — a text-only post is rejected before any API call. */
  imageRequired: boolean;
  /** Character ceiling for the body, or null when effectively unlimited. */
  maxChars: number | null;
  /** Messaging channel rather than a public feed. */
  messaging: boolean;
}

export interface ProviderDefinition {
  platform: SocialPlatform;
  label: string;
  /** Short note shown next to the connect button. */
  description: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** X requires PKCE; Meta and LinkedIn do not use it. */
  usesPkce: boolean;
  /** Providers that return a short-lived token we can exchange for a longer one. */
  supportsRefresh: boolean;
  capabilities: PlatformCapabilities;
  clientId: string;
  clientSecret: string;
  /** Human-readable list of what an operator must set to enable this provider. */
  requiredEnv: string[];
  /** Provider-side setup the credentials alone do not cover. */
  setupNote?: string;
}

const META_GRAPH = 'https://graph.facebook.com/v21.0';

export const GRAPH_BASE = META_GRAPH;

const DEFINITIONS: Record<SocialPlatform, ProviderDefinition> = {
  [SocialPlatform.facebook]: {
    platform: SocialPlatform.facebook,
    label: 'Facebook Pages',
    description: 'Publish to your Facebook Pages and read post insights.',
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: `${META_GRAPH}/oauth/access_token`,
    scopes: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'business_management'],
    usesPkce: false,
    supportsRefresh: false, // exchanged for a long-lived page token instead
    capabilities: { text: true, image: true, imageRequired: false, maxChars: 63_206, messaging: false },
    clientId: env.META_APP_ID,
    clientSecret: env.META_APP_SECRET,
    requiredEnv: ['META_APP_ID', 'META_APP_SECRET'],
    setupNote:
      'Meta requires App Review for pages_manage_posts before a live app can publish on behalf of other businesses.',
  },

  [SocialPlatform.instagram]: {
    platform: SocialPlatform.instagram,
    label: 'Instagram',
    description: 'Publish images to an Instagram Business account linked to a Facebook Page.',
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: `${META_GRAPH}/oauth/access_token`,
    scopes: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'business_management',
    ],
    usesPkce: false,
    supportsRefresh: false,
    // Instagram's publishing API has no text-only post type.
    capabilities: { text: true, image: true, imageRequired: true, maxChars: 2_200, messaging: false },
    clientId: env.META_APP_ID,
    clientSecret: env.META_APP_SECRET,
    requiredEnv: ['META_APP_ID', 'META_APP_SECRET'],
    setupNote:
      'The Instagram account must be a Business or Creator account linked to a Facebook Page. Publishing needs App Review for instagram_content_publish.',
  },

  [SocialPlatform.linkedin]: {
    platform: SocialPlatform.linkedin,
    label: 'LinkedIn',
    description: 'Publish updates to a company page or your personal profile.',
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['openid', 'profile', 'w_member_social'],
    usesPkce: false,
    supportsRefresh: true,
    capabilities: { text: true, image: true, imageRequired: false, maxChars: 3_000, messaging: false },
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    requiredEnv: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    setupNote:
      'Posting to a company page additionally needs the Community Management API product enabled on the LinkedIn app.',
  },

  [SocialPlatform.x]: {
    platform: SocialPlatform.x,
    label: 'X',
    description: 'Publish posts to X.',
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    usesPkce: true,
    supportsRefresh: true,
    capabilities: { text: true, image: true, imageRequired: false, maxChars: 280, messaging: false },
    clientId: env.X_CLIENT_ID,
    clientSecret: env.X_CLIENT_SECRET,
    requiredEnv: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
    setupNote: 'Posting requires a paid X API tier; the free tier is read-only for most endpoints.',
  },

  [SocialPlatform.whatsapp]: {
    platform: SocialPlatform.whatsapp,
    label: 'WhatsApp Business',
    description: 'Send template messages and replies through the WhatsApp Cloud API.',
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: `${META_GRAPH}/oauth/access_token`,
    scopes: ['whatsapp_business_messaging', 'whatsapp_business_management', 'business_management'],
    usesPkce: false,
    supportsRefresh: false,
    // A messaging channel, not a feed: it is connected here but does not accept
    // broadcast "posts", which is why the composer excludes it.
    capabilities: { text: true, image: true, imageRequired: false, maxChars: 4_096, messaging: true },
    clientId: env.META_APP_ID,
    clientSecret: env.META_APP_SECRET,
    requiredEnv: ['META_APP_ID', 'META_APP_SECRET'],
    setupNote:
      'Outside the 24-hour customer service window, WhatsApp only permits pre-approved message templates.',
  },
};

export function providerFor(platform: SocialPlatform): ProviderDefinition {
  return DEFINITIONS[platform];
}

export const ALL_PROVIDERS = Object.values(DEFINITIONS);

/** True when this server holds the client credentials for the platform. */
export function isConfigured(platform: SocialPlatform): boolean {
  const p = DEFINITIONS[platform];
  return p.clientId.length > 0 && p.clientSecret.length > 0;
}

/** Which required env vars are still missing, for an actionable UI message. */
export function missingEnv(platform: SocialPlatform): string[] {
  const p = DEFINITIONS[platform];
  const missing: string[] = [];
  if (!p.clientId) missing.push(p.requiredEnv[0]!);
  if (!p.clientSecret) missing.push(p.requiredEnv[1]!);
  return missing;
}

/**
 * The redirect URI handed to the provider. It must match the value registered
 * on the provider's app exactly, including scheme and trailing path, so it is
 * derived from one configured base rather than from the incoming request
 * (which an attacker can influence via Host).
 */
export function redirectUri(platform: SocialPlatform): string {
  return `${env.PUBLIC_API_URL.replace(/\/+$/, '')}/api/social/callback/${platform}`;
}

/** Public, non-secret view of a provider for the settings screen. */
export function describeProvider(platform: SocialPlatform) {
  const p = DEFINITIONS[platform];
  return {
    platform: p.platform,
    label: p.label,
    description: p.description,
    scopes: p.scopes,
    capabilities: p.capabilities,
    configured: isConfigured(platform),
    missingEnv: missingEnv(platform),
    setupNote: p.setupNote,
    redirectUri: redirectUri(platform),
  };
}
