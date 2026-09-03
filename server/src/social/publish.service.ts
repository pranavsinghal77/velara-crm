import { SocialPlatform, type SocialConnection } from '@prisma/client';
import { badRequest, serviceUnavailable } from '../utils/httpError';
import { logger } from '../utils/logger';
import { GRAPH_BASE, providerFor } from './providers';
import { usableAccessToken } from './oauth.service';

/**
 * Publishing adapters, one per platform.
 *
 * Each returns the provider's own post id and a permalink where available, so
 * the CRM can link back to what it created rather than claiming success with
 * nothing to show. A failure throws with the provider's message intact: the
 * previous implementation set a "Posted to Instagram, Facebook, LinkedIn!"
 * string and never called anything.
 */

export interface PublishInput {
  body: string;
  /** Base64 data URL, when the post carries an image. */
  mediaUrl?: string | null;
}

export interface PublishResult {
  externalPostId: string;
  permalink?: string;
}

const TIMEOUT_MS = 30_000;

export async function publishTo(
  connection: SocialConnection,
  input: PublishInput
): Promise<PublishResult> {
  const provider = providerFor(connection.platform);
  const caps = provider.capabilities;

  // Validate against the platform's own rules before spending a network call
  // and before telling the user anything succeeded.
  if (caps.messaging) {
    throw badRequest(
      `${provider.label} is a messaging channel, not a feed. Use the Inbox to send messages.`
    );
  }
  if (caps.imageRequired && !input.mediaUrl) {
    throw badRequest(`${provider.label} requires an image; a text-only post cannot be published.`);
  }
  if (!input.body.trim() && !input.mediaUrl) {
    throw badRequest('Nothing to publish.');
  }
  if (caps.maxChars && input.body.length > caps.maxChars) {
    throw badRequest(
      `${provider.label} allows ${caps.maxChars} characters; this post is ${input.body.length}.`
    );
  }

  const token = await usableAccessToken(connection.id);

  switch (connection.platform) {
    case SocialPlatform.facebook:
      return publishFacebook(connection, input, token);
    case SocialPlatform.instagram:
      return publishInstagram(connection, input, token);
    case SocialPlatform.linkedin:
      return publishLinkedIn(connection, input, token);
    case SocialPlatform.x:
      return publishX(input, token);
    default:
      throw badRequest(`Publishing to ${provider.label} is not supported.`);
  }
}

// --- Facebook Pages ----------------------------------------------------------

async function publishFacebook(
  connection: SocialConnection,
  input: PublishInput,
  token: string
): Promise<PublishResult> {
  // A page photo post and a text post are different endpoints on Graph.
  const endpoint = input.mediaUrl
    ? `${GRAPH_BASE}/${connection.externalId}/photos`
    : `${GRAPH_BASE}/${connection.externalId}/feed`;

  const body: Record<string, string> = input.mediaUrl
    ? { caption: input.body, url: input.mediaUrl, access_token: token }
    : { message: input.body, access_token: token };

  const data = await call<{ id?: string; post_id?: string }>(
    endpoint,
    body,
    'Facebook'
  );

  const id = data.post_id ?? data.id;
  if (!id) throw serviceUnavailable('Facebook did not return a post id.');

  return { externalPostId: id, permalink: `https://www.facebook.com/${id}` };
}

// --- Instagram ---------------------------------------------------------------

/**
 * Instagram publishing is two steps: create a media container, then publish
 * it. The container is not visible until the second call succeeds, so a
 * failure between them leaves nothing half-posted.
 */
async function publishInstagram(
  connection: SocialConnection,
  input: PublishInput,
  token: string
): Promise<PublishResult> {
  if (!input.mediaUrl) {
    throw badRequest('Instagram requires an image.');
  }

  const container = await call<{ id?: string }>(
    `${GRAPH_BASE}/${connection.externalId}/media`,
    { image_url: input.mediaUrl, caption: input.body, access_token: token },
    'Instagram (media container)'
  );

  if (!container.id) {
    throw serviceUnavailable('Instagram did not return a media container id.');
  }

  const published = await call<{ id?: string }>(
    `${GRAPH_BASE}/${connection.externalId}/media_publish`,
    { creation_id: container.id, access_token: token },
    'Instagram (publish)'
  );

  if (!published.id) throw serviceUnavailable('Instagram did not confirm publication.');

  return { externalPostId: published.id };
}

// --- LinkedIn ----------------------------------------------------------------

async function publishLinkedIn(
  connection: SocialConnection,
  input: PublishInput,
  token: string
): Promise<PublishResult> {
  // externalId holds the author URN (person or organisation).
  const payload = {
    author: connection.externalId,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: input.body },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const res = await fetchWithTimeout('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

  if (!res.ok || !data?.id) {
    throw providerError('LinkedIn', res.status, data?.message);
  }

  return {
    externalPostId: data.id,
    permalink: `https://www.linkedin.com/feed/update/${data.id}`,
  };
}

// --- X -----------------------------------------------------------------------

async function publishX(input: PublishInput, token: string): Promise<PublishResult> {
  const res = await fetchWithTimeout('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: input.body }),
  });

  const data = (await res.json().catch(() => null)) as
    | { data?: { id?: string }; detail?: string; title?: string }
    | null;

  if (!res.ok || !data?.data?.id) {
    throw providerError('X', res.status, data?.detail ?? data?.title);
  }

  return {
    externalPostId: data.data.id,
    permalink: `https://x.com/i/web/status/${data.data.id}`,
  };
}

// --- Shared plumbing ---------------------------------------------------------

/** Graph API calls are form-encoded POSTs returning JSON. */
async function call<T>(
  url: string,
  form: Record<string, string>,
  label: string
): Promise<T> {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });

  const data = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: number } })
    | null;

  if (!res.ok || data?.error) {
    throw providerError(label, res.status, data?.error?.message);
  }
  if (!data) throw serviceUnavailable(`${label} returned an empty response.`);

  return data;
}

function providerError(label: string, status: number, message?: string) {
  // The provider's own message is the useful part; surface it rather than a
  // generic failure the user cannot act on.
  logger.warn(`${label} publish failed`, { status, message });

  if (status === 401 || status === 403) {
    return badRequest(
      `${label} rejected the request: ${message ?? 'permission denied'}. The connection may need reconnecting with additional permissions.`
    );
  }
  if (status === 429) {
    return serviceUnavailable(`${label} rate limit reached. Try again shortly.`);
  }
  return badRequest(`${label} rejected the post: ${message ?? `HTTP ${status}`}`);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw serviceUnavailable('The platform did not respond in time.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads back the accounts a Meta token can act as. Meta hands out a *user*
 * token; the publishable identities are the pages behind it, and for Instagram
 * the business account linked to each page.
 */
export async function discoverMetaAccounts(
  platform: SocialPlatform,
  userToken: string
): Promise<{ externalId: string; handle: string; avatarUrl?: string; pageToken: string }[]> {
  const url = new URL(`${GRAPH_BASE}/me/accounts`);
  url.searchParams.set('fields', 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}');
  url.searchParams.set('access_token', userToken);

  const res = await fetchWithTimeout(url.toString(), { method: 'GET' });
  const data = (await res.json().catch(() => null)) as {
    data?: {
      id: string;
      name: string;
      access_token: string;
      picture?: { data?: { url?: string } };
      instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
    }[];
    error?: { message?: string };
  } | null;

  if (!res.ok || data?.error) {
    throw providerError('Meta', res.status, data?.error?.message);
  }

  const pages = data?.data ?? [];

  if (platform === SocialPlatform.instagram) {
    return pages
      .filter((p) => p.instagram_business_account?.id)
      .map((p) => ({
        externalId: p.instagram_business_account!.id,
        handle: p.instagram_business_account!.username
          ? `@${p.instagram_business_account!.username}`
          : p.name,
        avatarUrl: p.instagram_business_account!.profile_picture_url,
        // IG publishing uses the linked page's token.
        pageToken: p.access_token,
      }));
  }

  return pages.map((p) => ({
    externalId: p.id,
    handle: p.name,
    avatarUrl: p.picture?.data?.url,
    pageToken: p.access_token,
  }));
}

/** LinkedIn identity, for the connection's author URN and display handle. */
export async function discoverLinkedInIdentity(
  token: string
): Promise<{ externalId: string; handle: string; avatarUrl?: string }> {
  const res = await fetchWithTimeout('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = (await res.json().catch(() => null)) as
    | { sub?: string; name?: string; picture?: string }
    | null;

  if (!res.ok || !data?.sub) {
    throw providerError('LinkedIn', res.status, 'could not read profile');
  }

  return {
    externalId: `urn:li:person:${data.sub}`,
    handle: data.name ?? 'LinkedIn profile',
    avatarUrl: data.picture,
  };
}

/** X identity. */
export async function discoverXIdentity(
  token: string
): Promise<{ externalId: string; handle: string; avatarUrl?: string }> {
  const res = await fetchWithTimeout(
    'https://api.twitter.com/2/users/me?user.fields=profile_image_url,username',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = (await res.json().catch(() => null)) as
    | { data?: { id?: string; username?: string; profile_image_url?: string } }
    | null;

  if (!res.ok || !data?.data?.id) {
    throw providerError('X', res.status, 'could not read profile');
  }

  return {
    externalId: data.data.id,
    handle: data.data.username ? `@${data.data.username}` : 'X account',
    avatarUrl: data.data.profile_image_url,
  };
}

/** WhatsApp Business phone numbers the token can send from. */
export async function discoverWhatsAppNumbers(
  token: string
): Promise<{ externalId: string; handle: string }[]> {
  const url = new URL(`${GRAPH_BASE}/me/businesses`);
  url.searchParams.set('access_token', token);

  const res = await fetchWithTimeout(url.toString(), { method: 'GET' });
  const data = (await res.json().catch(() => null)) as
    | { data?: { id: string; name: string }[]; error?: { message?: string } }
    | null;

  if (!res.ok || data?.error) {
    throw providerError('WhatsApp', res.status, data?.error?.message);
  }

  // The business is the connectable identity; the specific phone number id is
  // selected per send, since one business can hold several.
  return (data?.data ?? []).map((b) => ({ externalId: b.id, handle: b.name }));
}
