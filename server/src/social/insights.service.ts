import { SocialPlatform, SocialPostStatus, type SocialConnection } from '@prisma/client';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';
import { GRAPH_BASE, providerFor } from './providers';
import { usableAccessToken } from './oauth.service';

/**
 * Reading engagement back from the platforms.
 *
 * This is the half of the integration that was missing. Publishing worked, but
 * nothing ever asked the providers how a post had done, so the two performance
 * panels rendered `PLATFORM_ANALYTICS` and a `FeedPost[]` literal — hardcoded
 * follower counts and invented like totals, labelled "sample data" because
 * that is exactly what they were.
 *
 * The governing rule here: a figure the provider does not return is recorded as
 * *unavailable*, never as zero. The APIs genuinely differ in what they expose —
 * Instagram reports no share count, LinkedIn reports no impressions without the
 * Community Management product, and X's impression count is absent on older
 * posts — and "0 shares" is a claim about the post, while "Instagram does not
 * report shares" is a claim about the API. Only the second one is true.
 */

const TIMEOUT_MS = 20_000;

export interface PostMetrics {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  videoViews?: number;
  /** Metrics this platform does not report, each with the reason. */
  unavailable: string[];
}

export interface AccountMetrics {
  followers?: number;
  postCount?: number;
  impressions28d?: number;
  unavailable: string[];
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = (await res.json().catch(() => null)) as
      | (T & { error?: { message?: string; code?: number } })
      | null;

    if (!res.ok || data?.error) {
      const detail = data?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(detail);
    }
    if (!data) throw new Error('The platform returned no data.');

    return data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('The platform did not respond in time.');
    }
    if (err instanceof TypeError) {
      throw new Error('Could not reach the platform (network error).');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Pulls a named metric out of a Graph insights payload. */
function graphMetric(
  payload: { data?: { name?: string; values?: { value?: number }[] }[] },
  name: string
): number | undefined {
  const row = payload.data?.find((d) => d.name === name);
  const value = row?.values?.[0]?.value;
  return typeof value === 'number' ? value : undefined;
}

/**
 * Engagements over reach.
 *
 * Reach, not impressions: the same person seeing a post three times is one
 * chance to engage, not three, so dividing by impressions understates every
 * post. Null when reach is unknown or zero rather than dividing by it.
 */
export function engagementRate(m: PostMetrics): number | null {
  if (!m.reach) return null;

  const engagements = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.clicks ?? 0);
  return engagements / m.reach;
}

// --- Per-post metrics --------------------------------------------------------

/**
 * Mapping is separated from fetching throughout this section.
 *
 * Each provider returns a differently-shaped payload and the interesting work
 * is deciding what it means — which absent field is a real zero and which is a
 * metric the API simply does not have. That decision is worth testing, and a
 * pure function can be tested without a network or a database.
 */

export interface FacebookCounts {
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

export type GraphInsights = { data?: { name?: string; values?: { value?: number }[] }[] };

export function mapFacebookMetrics(
  counts: FacebookCounts,
  insights: GraphInsights | { error: string }
): PostMetrics {
  const metrics: PostMetrics = {
    likes: counts.likes?.summary?.total_count,
    comments: counts.comments?.summary?.total_count,
    // Graph omits `shares` entirely when there are none, and reports it
    // whenever there are any — so absence here is a measured zero, not a gap.
    shares: counts.shares?.count ?? 0,
    unavailable: [],
  };

  if ('error' in insights) {
    metrics.unavailable.push(`impressions: ${insights.error}`);
    return metrics;
  }

  metrics.impressions = graphMetric(insights, 'post_impressions');
  metrics.reach = graphMetric(insights, 'post_impressions_unique');
  metrics.clicks = graphMetric(insights, 'post_clicks');
  return metrics;
}

export function mapInstagramMetrics(
  counts: { like_count?: number; comments_count?: number },
  insights: GraphInsights | { error: string }
): PostMetrics {
  const metrics: PostMetrics = {
    likes: counts.like_count,
    comments: counts.comments_count,
    // Not an omission on our side: the Instagram Graph API exposes no share
    // count for a media object at all.
    unavailable: ['shares: not reported by the Instagram Graph API'],
  };

  if ('error' in insights) {
    metrics.unavailable.push(`reach: ${insights.error}`);
    return metrics;
  }

  metrics.impressions = graphMetric(insights, 'impressions');
  metrics.reach = graphMetric(insights, 'reach');
  return metrics;
}

export function mapLinkedInMetrics(data: {
  likesSummary?: { totalLikes?: number };
  commentsSummary?: { aggregatedTotalComments?: number };
}): PostMetrics {
  return {
    likes: data.likesSummary?.totalLikes,
    comments: data.commentsSummary?.aggregatedTotalComments,
    unavailable: [
      'impressions: requires the LinkedIn Community Management API product',
      'reach: requires the LinkedIn Community Management API product',
    ],
  };
}

export function mapXMetrics(pm: {
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  quote_count?: number;
  impression_count?: number;
}): PostMetrics {
  const unavailable = ['reach: X reports impressions only, not unique reach'];

  // An older post predates impression reporting. Recording that as 0
  // impressions would say the post was never seen.
  if (pm.impression_count === undefined) {
    unavailable.push('impressions: not available on this post');
  }

  return {
    likes: pm.like_count,
    comments: pm.reply_count,
    // A quote is a share with commentary; counting only retweets would
    // undercount how often the post was passed on.
    shares: (pm.retweet_count ?? 0) + (pm.quote_count ?? 0),
    impressions: pm.impression_count,
    unavailable,
  };
}

/**
 * Graph insights can fail on their own — a post minutes old has none yet —
 * without costing us the engagement counts we already hold. This turns that
 * failure into a value the mapper can record as unavailable.
 */
async function tryGraphInsights(
  url: string
): Promise<GraphInsights | { error: string }> {
  try {
    return await getJson<GraphInsights>(url);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'not returned by the platform' };
  }
}

async function facebookPostMetrics(postId: string, token: string): Promise<PostMetrics> {
  const auth = encodeURIComponent(token);
  const counts = await getJson<FacebookCounts>(
    `${GRAPH_BASE}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${auth}`
  );
  const insights = await tryGraphInsights(
    `${GRAPH_BASE}/${postId}/insights?metric=post_impressions,post_impressions_unique,post_clicks&access_token=${auth}`
  );

  return mapFacebookMetrics(counts, insights);
}

async function instagramPostMetrics(mediaId: string, token: string): Promise<PostMetrics> {
  const auth = encodeURIComponent(token);
  const counts = await getJson<{ like_count?: number; comments_count?: number }>(
    `${GRAPH_BASE}/${mediaId}?fields=like_count,comments_count&access_token=${auth}`
  );
  const insights = await tryGraphInsights(
    `${GRAPH_BASE}/${mediaId}/insights?metric=impressions,reach,saved&access_token=${auth}`
  );

  return mapInstagramMetrics(counts, insights);
}

async function linkedInPostMetrics(urn: string, token: string): Promise<PostMetrics> {
  const data = await getJson<Parameters<typeof mapLinkedInMetrics>[0]>(
    `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(urn)}`,
    { headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': '202405' } }
  );

  return mapLinkedInMetrics(data);
}

async function xPostMetrics(tweetId: string, token: string): Promise<PostMetrics> {
  const data = await getJson<{ data?: { public_metrics?: Parameters<typeof mapXMetrics>[0] } }>(
    `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const pm = data.data?.public_metrics;
  if (!pm) throw new Error('X returned no public metrics for this post.');

  return mapXMetrics(pm);
}

/** Metrics for one delivered target, or a thrown error naming the platform. */
export async function fetchPostMetrics(
  connection: SocialConnection,
  externalPostId: string
): Promise<PostMetrics> {
  const token = await usableAccessToken(connection.id);

  switch (connection.platform) {
    case SocialPlatform.facebook:
      return facebookPostMetrics(externalPostId, token);
    case SocialPlatform.instagram:
      return instagramPostMetrics(externalPostId, token);
    case SocialPlatform.linkedin:
      return linkedInPostMetrics(externalPostId, token);
    case SocialPlatform.x:
      return xPostMetrics(externalPostId, token);
    default:
      throw new Error(
        `${providerFor(connection.platform).label} is a messaging channel and has no post insights.`
      );
  }
}

// --- Account metrics ---------------------------------------------------------

export async function fetchAccountMetrics(connection: SocialConnection): Promise<AccountMetrics> {
  const token = await usableAccessToken(connection.id);

  switch (connection.platform) {
    case SocialPlatform.facebook: {
      const data = await getJson<{ followers_count?: number; fan_count?: number }>(
        `${GRAPH_BASE}/${connection.externalId}?fields=followers_count,fan_count` +
          `&access_token=${encodeURIComponent(token)}`
      );
      return {
        // followers_count is the modern field; fan_count is the page-likes
        // legacy one, kept as a fallback for pages that still only return it.
        followers: data.followers_count ?? data.fan_count,
        unavailable: [],
      };
    }

    case SocialPlatform.instagram: {
      const data = await getJson<{ followers_count?: number; media_count?: number }>(
        `${GRAPH_BASE}/${connection.externalId}?fields=followers_count,media_count` +
          `&access_token=${encodeURIComponent(token)}`
      );
      return {
        followers: data.followers_count,
        postCount: data.media_count,
        unavailable: [],
      };
    }

    case SocialPlatform.x: {
      const data = await getJson<{
        data?: { public_metrics?: { followers_count?: number; tweet_count?: number } };
      }>(
        `https://api.twitter.com/2/users/${connection.externalId}?user.fields=public_metrics`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return {
        followers: data.data?.public_metrics?.followers_count,
        postCount: data.data?.public_metrics?.tweet_count,
        unavailable: [],
      };
    }

    case SocialPlatform.linkedin:
      // A personal profile has no follower-count endpoint at all, and an
      // organisation page needs the Community Management product. Saying so
      // beats reporting a number we cannot obtain.
      return {
        unavailable: connection.externalId.startsWith('urn:li:person:')
          ? ['followers: LinkedIn exposes no follower count for personal profiles']
          : ['followers: requires the LinkedIn Community Management API product'],
      };

    default:
      return { unavailable: ['WhatsApp Business is a messaging channel with no audience metrics'] };
  }
}

// --- Persistence -------------------------------------------------------------

/**
 * Refreshes stored metrics for one organisation.
 *
 * Failures are recorded against the row rather than thrown: one revoked
 * connection must not stop the rest of the refresh, and a stored figure with a
 * `fetchError` beside it is more useful than no figure at all.
 *
 * `maxAgeMinutes` skips rows refreshed recently, which is what makes this safe
 * to call both from the scheduler and from a user pressing Refresh — the second
 * caller does no provider work.
 */
export async function refreshOrgInsights(
  orgId: string,
  opts: { maxAgeMinutes?: number; postLimit?: number } = {}
): Promise<{ posts: number; accounts: number; skipped: number; failed: number }> {
  const { maxAgeMinutes = 15, postLimit = 40 } = opts;
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);

  let posts = 0;
  let accounts = 0;
  let skipped = 0;
  let failed = 0;

  // ── Accounts ──
  const connections = await prisma.socialConnection.findMany({
    where: { orgId },
    include: { metrics: true },
  });

  for (const connection of connections) {
    if (connection.metrics && connection.metrics.fetchedAt > cutoff) {
      skipped += 1;
      continue;
    }

    try {
      const m = await fetchAccountMetrics(connection);
      await prisma.socialAccountMetric.upsert({
        where: { connectionId: connection.id },
        create: { orgId, connectionId: connection.id, ...m },
        update: { ...m, fetchedAt: new Date(), fetchError: null },
      });
      accounts += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : 'Metrics fetch failed';
      await prisma.socialAccountMetric.upsert({
        where: { connectionId: connection.id },
        create: { orgId, connectionId: connection.id, unavailable: [], fetchError: message },
        update: { fetchedAt: new Date(), fetchError: message },
      });
      logger.warn('Social account metrics failed', {
        platform: connection.platform,
        error: message,
      });
    }
  }

  // ── Posts ──
  const targets = await prisma.socialPostTarget.findMany({
    where: {
      status: SocialPostStatus.Published,
      externalPostId: { not: null },
      post: { orgId },
    },
    include: { connection: true, metrics: true },
    orderBy: { publishedAt: 'desc' },
    take: postLimit,
  });

  for (const target of targets) {
    if (target.metrics && target.metrics.fetchedAt > cutoff) {
      skipped += 1;
      continue;
    }

    try {
      const m = await fetchPostMetrics(target.connection, target.externalPostId!);
      const rate = engagementRate(m);

      await prisma.socialPostMetric.upsert({
        where: { targetId: target.id },
        create: { orgId, targetId: target.id, ...m, engagementRate: rate },
        update: { ...m, engagementRate: rate, fetchedAt: new Date(), fetchError: null },
      });
      posts += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : 'Metrics fetch failed';
      await prisma.socialPostMetric.upsert({
        where: { targetId: target.id },
        create: { orgId, targetId: target.id, unavailable: [], fetchError: message },
        update: { fetchedAt: new Date(), fetchError: message },
      });
      logger.warn('Social post metrics failed', {
        platform: target.connection.platform,
        error: message,
      });
    }
  }

  return { posts, accounts, skipped, failed };
}
