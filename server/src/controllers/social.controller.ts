import {
  SocialConnectionStatus,
  SocialPlatform,
  SocialPostStatus,
  UsageKind,
  type SocialConnection,
} from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { validatedParams, validatedQuery } from '../middlewares/validate';
import { record } from '../billing/usage.service';
import { encrypt, encryptionAvailable } from '../utils/encryption';
import { badRequest, notFound, serviceUnavailable } from '../utils/httpError';
import { logger } from '../utils/logger';
import { ALL_PROVIDERS, describeProvider, providerFor } from '../social/providers';
import {
  appUrl,
  beginAuthorization,
  consumeState,
  exchangeCode,
  exchangeForLongLivedMetaToken,
  refreshAccessToken,
} from '../social/oauth.service';
import {
  discoverLinkedInIdentity,
  discoverMetaAccounts,
  discoverWhatsAppNumbers,
  discoverXIdentity,
} from '../social/publish.service';
import { MAX_ATTEMPTS, deliverPost, publishDuePosts } from '../social/delivery.service';
import { refreshOrgInsights } from '../social/insights.service';
import { assertWithinLimit } from '../billing/usage.service';
import { resolveAiCredential } from '../services/aiCredential.service';
import { asUntrustedInput, generateJson } from '../services/ai.service';
import { z } from 'zod';
import type { IdParam } from '../schemas';

/**
 * Social channel connections and publishing.
 *
 * The previous version of this feature reported seven services as "Connected"
 * from a hardcoded array and had a Post button that set a success string. Every
 * status here is read from a stored OAuth grant, and every publish result is
 * whatever the provider actually returned.
 */

const META_PLATFORMS: SocialPlatform[] = [
  SocialPlatform.facebook,
  SocialPlatform.instagram,
  SocialPlatform.whatsapp,
];

function serializeConnection(c: SocialConnection) {
  const provider = providerFor(c.platform);
  return {
    id: c.id,
    platform: c.platform,
    label: provider.label,
    handle: c.handle,
    avatarUrl: c.avatarUrl ?? undefined,
    status: c.status,
    statusDetail: c.statusDetail,
    scopes: c.scopes,
    isDefault: c.isDefault,
    capabilities: provider.capabilities,
    // Surfaced so the UI can warn before a token dies rather than after.
    expiresAt: c.expiresAt?.toISOString() ?? null,
    expiringSoon: c.expiresAt ? c.expiresAt.getTime() - Date.now() < 7 * 86_400_000 : false,
    lastPublishAt: c.lastPublishAt?.toISOString() ?? null,
    connectedAt: c.createdAt.toISOString(),
  };
}

/** GET /api/social/providers — the catalogue, with real availability. */
export async function listProviders(req: Request, res: Response) {
  const { orgId } = auth(req);

  const connections = await prisma.socialConnection.findMany({ where: { orgId } });

  res.json({
    data: ALL_PROVIDERS.map((p) => {
      const mine = connections.filter((c) => c.platform === p.platform);
      return {
        ...describeProvider(p.platform),
        connections: mine.map(serializeConnection),
        connectedCount: mine.filter((c) => c.status === SocialConnectionStatus.Connected).length,
      };
    }),
    // Without an encryption key we refuse to store tokens at all, so the UI
    // should explain that rather than offering a Connect button that 503s.
    encryptionAvailable: encryptionAvailable(),
  });
}

/** GET /api/social/connections */
export async function listConnections(req: Request, res: Response) {
  const { orgId } = auth(req);
  const rows = await prisma.socialConnection.findMany({
    where: { orgId },
    orderBy: [{ platform: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ data: rows.map(serializeConnection) });
}

/**
 * POST /api/social/connect/:platform
 *
 * Returns the provider consent URL for the client to navigate to. Returning a
 * URL rather than a 302 keeps this callable by fetch, which cannot follow a
 * cross-origin redirect to a login page.
 */
export async function startConnect(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const platform = req.params.platform as SocialPlatform;

  if (!Object.values(SocialPlatform).includes(platform)) {
    throw badRequest('Unknown platform');
  }
  if (!encryptionAvailable()) {
    throw serviceUnavailable(
      'This server has no ENCRYPTION_KEY configured, so platform tokens cannot be stored securely.'
    );
  }

  const url = await beginAuthorization({ platform, orgId, userId });
  res.json({ authorizeUrl: url });
}

/**
 * GET /api/social/callback/:platform
 *
 * Reached by a top-level browser navigation from the provider, so it carries no
 * Authorization header — the request is authenticated by the single-use `state`
 * row, and it answers with a redirect back into the app rather than JSON.
 */
export async function handleCallback(req: Request, res: Response) {
  const platform = req.params.platform as SocialPlatform;
  const { code, state, error, error_description: errorDescription } = req.query as Record<
    string,
    string | undefined
  >;

  const back = (params: Record<string, string>) => {
    const url = new URL(`${appUrl()}/settings`);
    url.searchParams.set('tab', 'integrations');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return res.redirect(url.toString());
  };

  // The user declined, or the provider rejected the request.
  if (error) {
    return back({
      social_error: errorDescription ?? error,
      social_platform: platform,
    });
  }
  if (!code || !state) {
    return back({ social_error: 'Missing authorisation code', social_platform: platform });
  }

  try {
    const stateRow = await consumeState(state);

    if (stateRow.platform !== platform) {
      return back({ social_error: 'Authorisation platform mismatch', social_platform: platform });
    }

    const tokens = await exchangeCode({
      platform,
      code,
      codeVerifier: stateRow.codeVerifier,
    });

    const saved = await persistConnections({
      platform,
      orgId: stateRow.orgId,
      userId: stateRow.userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      grantedScopes: tokens.scope,
    });

    return back({
      social_connected: platform,
      social_accounts: String(saved),
    });
  } catch (err) {
    logger.warn('Social callback failed', {
      platform,
      error: err instanceof Error ? err.message : String(err),
    });
    return back({
      social_error: err instanceof Error ? err.message : 'Connection failed',
      social_platform: platform,
    });
  }
}

/**
 * Turns a fresh grant into stored connections.
 *
 * Meta hands out a short-lived *user* token, while the publishable identities
 * are the pages (and their linked Instagram business accounts) behind it, each
 * with its own long-lived page token. Discovering them here is what stops the
 * connection dying an hour after it is made.
 */
async function persistConnections(params: {
  platform: SocialPlatform;
  orgId: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  grantedScopes?: string;
}): Promise<number> {
  const { platform, orgId, userId, accessToken, refreshToken, expiresIn, grantedScopes } = params;
  const scopes = grantedScopes ? grantedScopes.split(/[\s,]+/).filter(Boolean) : [];

  const existingCount = await prisma.socialConnection.count({ where: { orgId, platform } });

  const upsert = async (account: {
    externalId: string;
    handle: string;
    avatarUrl?: string;
    token: string;
    expiresAt: Date | null;
    refresh?: string;
  }, index: number) => {
    await prisma.socialConnection.upsert({
      where: {
        orgId_platform_externalId: { orgId, platform, externalId: account.externalId },
      },
      create: {
        orgId,
        platform,
        externalId: account.externalId,
        handle: account.handle,
        avatarUrl: account.avatarUrl,
        accessTokenEnc: encrypt(account.token),
        refreshTokenEnc: account.refresh ? encrypt(account.refresh) : null,
        expiresAt: account.expiresAt,
        scopes,
        status: SocialConnectionStatus.Connected,
        statusDetail: null,
        // First account connected for a platform becomes its default target.
        isDefault: existingCount === 0 && index === 0,
        connectedById: userId,
        lastCheckedAt: new Date(),
      },
      update: {
        handle: account.handle,
        avatarUrl: account.avatarUrl,
        accessTokenEnc: encrypt(account.token),
        ...(account.refresh ? { refreshTokenEnc: encrypt(account.refresh) } : {}),
        expiresAt: account.expiresAt,
        scopes,
        status: SocialConnectionStatus.Connected,
        statusDetail: null,
        lastCheckedAt: new Date(),
      },
    });
  };

  if (META_PLATFORMS.includes(platform)) {
    // Trade the short-lived user token for a long-lived one before asking it
    // what it can act as.
    const longLived = await exchangeForLongLivedMetaToken(accessToken);
    const userToken = longLived.access_token;
    const userTokenExpiry = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : null;

    if (platform === SocialPlatform.whatsapp) {
      const businesses = await discoverWhatsAppNumbers(userToken);
      if (businesses.length === 0) {
        throw badRequest(
          'No WhatsApp Business account was found on this Meta login. Create one in Meta Business Suite first.'
        );
      }
      await Promise.all(
        businesses.map((b, i) =>
          upsert(
            { externalId: b.externalId, handle: b.handle, token: userToken, expiresAt: userTokenExpiry },
            i
          )
        )
      );
      return businesses.length;
    }

    const accounts = await discoverMetaAccounts(platform, userToken);
    if (accounts.length === 0) {
      throw badRequest(
        platform === SocialPlatform.instagram
          ? 'No Instagram Business account was found. Link one to a Facebook Page you manage, then reconnect.'
          : 'No Facebook Pages were found on this login. You must be an admin of at least one Page.'
      );
    }

    await Promise.all(
      accounts.map((a, i) =>
        upsert(
          {
            externalId: a.externalId,
            handle: a.handle,
            avatarUrl: a.avatarUrl,
            // Page tokens do not expire while the grant stands.
            token: a.pageToken,
            expiresAt: null,
          },
          i
        )
      )
    );
    return accounts.length;
  }

  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

  if (platform === SocialPlatform.linkedin) {
    const me = await discoverLinkedInIdentity(accessToken);
    await upsert({ ...me, token: accessToken, expiresAt, refresh: refreshToken }, 0);
    return 1;
  }

  if (platform === SocialPlatform.x) {
    const me = await discoverXIdentity(accessToken);
    await upsert({ ...me, token: accessToken, expiresAt, refresh: refreshToken }, 0);
    return 1;
  }

  throw badRequest('Unsupported platform');
}

/** DELETE /api/social/connections/:id */
export async function disconnect(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const conn = await prisma.socialConnection.findFirst({ where: { id, orgId } });
  if (!conn) throw notFound('Connection not found');

  await prisma.socialConnection.delete({ where: { id } });

  // Promote another account so the platform keeps a default target.
  if (conn.isDefault) {
    const next = await prisma.socialConnection.findFirst({
      where: { orgId, platform: conn.platform },
      orderBy: { createdAt: 'asc' },
    });
    if (next) {
      await prisma.socialConnection.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  res.status(204).end();
}

/** PUT /api/social/connections/:id/default */
export async function setDefault(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const conn = await prisma.socialConnection.findFirst({ where: { id, orgId } });
  if (!conn) throw notFound('Connection not found');

  await prisma.$transaction([
    prisma.socialConnection.updateMany({
      where: { orgId, platform: conn.platform },
      data: { isDefault: false },
    }),
    prisma.socialConnection.update({ where: { id }, data: { isDefault: true } }),
  ]);

  const updated = await prisma.socialConnection.findUniqueOrThrow({ where: { id } });
  res.json(serializeConnection(updated));
}

/**
 * POST /api/social/connections/:id/verify
 *
 * Refreshes the token if it is refreshable and records the outcome, so the
 * status shown is one we have actually tested.
 */
export async function verifyConnection(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const conn = await prisma.socialConnection.findFirst({ where: { id, orgId } });
  if (!conn) throw notFound('Connection not found');

  try {
    if (conn.expiresAt) {
      await refreshAccessToken(id);
    }
    const updated = await prisma.socialConnection.update({
      where: { id },
      data: {
        status: SocialConnectionStatus.Connected,
        statusDetail: null,
        lastCheckedAt: new Date(),
      },
    });
    res.json(serializeConnection(updated));
  } catch (err) {
    const updated = await prisma.socialConnection.update({
      where: { id },
      data: {
        status: SocialConnectionStatus.Expired,
        statusDetail: err instanceof Error ? err.message : 'Verification failed',
        lastCheckedAt: new Date(),
      },
    });
    res.json(serializeConnection(updated));
  }
}

// --- Posts -------------------------------------------------------------------

async function serializePost(postId: string) {
  const post = await prisma.socialPost.findUniqueOrThrow({
    where: { id: postId },
    include: { targets: { include: { connection: true } } },
  });

  return {
    id: post.id,
    body: post.body,
    hasMedia: Boolean(post.mediaUrl),
    status: post.status,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    targets: post.targets.map((t) => ({
      id: t.id,
      connectionId: t.connectionId,
      platform: t.connection.platform,
      handle: t.connection.handle,
      status: t.status,
      externalPostId: t.externalPostId,
      permalink: t.permalink,
      error: t.error,
      attempts: t.attempts,
      publishedAt: t.publishedAt?.toISOString() ?? null,
    })),
  };
}

/**
 * POST /api/social/posts
 *
 * Creates the post and either publishes immediately or schedules it. Validation
 * against each platform's rules happens per target, so a post that Instagram
 * will reject fails on that target alone rather than silently claiming success
 * everywhere.
 */
export async function createPost(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const { body, mediaUrl, mediaMime, connectionIds, scheduledAt } = req.body as {
    body: string;
    mediaUrl?: string;
    mediaMime?: string;
    connectionIds: string[];
    scheduledAt?: string;
  };

  const connections = await prisma.socialConnection.findMany({
    where: { id: { in: connectionIds }, orgId },
  });

  if (connections.length !== connectionIds.length) {
    throw badRequest('One or more selected accounts do not belong to this workspace.');
  }

  const unusable = connections.filter((c) => c.status !== SocialConnectionStatus.Connected);
  if (unusable.length > 0) {
    throw badRequest(
      `These accounts need reconnecting first: ${unusable.map((c) => c.handle).join(', ')}.`
    );
  }

  const messaging = connections.filter((c) => providerFor(c.platform).capabilities.messaging);
  if (messaging.length > 0) {
    throw badRequest(
      `${messaging.map((c) => providerFor(c.platform).label).join(', ')} is a messaging channel and cannot receive feed posts.`
    );
  }

  const scheduled = scheduledAt ? new Date(scheduledAt) : null;
  if (scheduled && scheduled.getTime() < Date.now() - 60_000) {
    throw badRequest('Scheduled time is in the past.');
  }

  const post = await prisma.socialPost.create({
    data: {
      orgId,
      body,
      mediaUrl: mediaUrl ?? null,
      mediaMime: mediaMime ?? null,
      createdById: userId,
      scheduledAt: scheduled,
      status: scheduled ? SocialPostStatus.Scheduled : SocialPostStatus.Publishing,
      targets: {
        create: connections.map((c) => ({
          connectionId: c.id,
          status: SocialPostStatus.Scheduled,
        })),
      },
    },
  });

  if (!scheduled) {
    await deliverPost({ postId: post.id, orgId, userId });
  }

  res.status(201).json(await serializePost(post.id));
}

/** POST /api/social/posts/:id/publish — publish now, or retry failed targets. */
export async function publishPost(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const post = await prisma.socialPost.findFirst({ where: { id, orgId } });
  if (!post) throw notFound('Post not found');
  if (post.status === SocialPostStatus.Published) {
    throw badRequest('This post has already been published everywhere.');
  }

  const outcome = await deliverPost({ postId: id, orgId, userId });

  res.json({
    ...(await serializePost(id)),
    // A retry that attempted nothing because every failed target had used its
    // three attempts looks identical to one that tried and failed again. Say
    // which it was, so the UI is not left implying an attempt it never made.
    attempted: outcome.published + outcome.failed - outcome.exhausted,
    exhausted: outcome.exhausted,
    ...(outcome.exhausted > 0 && outcome.published === 0
      ? {
          notice: `No attempt was made: ${outcome.exhausted} target(s) have already used their ${MAX_ATTEMPTS} attempts. Fix the cause and create a new post.`,
        }
      : {}),
  });
}


/** GET /api/social/posts */
export async function listPosts(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { limit, status } = validatedQuery<{ limit: number; status?: SocialPostStatus }>(req);

  const posts = await prisma.socialPost.findMany({
    where: { orgId, ...(status ? { status } : {}) },
    include: { targets: { include: { connection: true } } },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });

  res.json({
    data: posts.map((post) => ({
      id: post.id,
      body: post.body,
      hasMedia: Boolean(post.mediaUrl),
      status: post.status,
      scheduledAt: post.scheduledAt?.toISOString() ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      targets: post.targets.map((t) => ({
        id: t.id,
        platform: t.connection.platform,
        handle: t.connection.handle,
        status: t.status,
        permalink: t.permalink,
        error: t.error,
      })),
    })),
  });
}

/** DELETE /api/social/posts/:id — cancels a schedule or removes a draft. */
export async function cancelPost(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const post = await prisma.socialPost.findFirst({ where: { id, orgId } });
  if (!post) throw notFound('Post not found');

  // A published post exists on the platform; deleting our record would not
  // remove it there, so say so rather than implying it was retracted.
  if (
    post.status === SocialPostStatus.Published ||
    post.status === SocialPostStatus.PartiallyPublished
  ) {
    throw badRequest(
      'This post is already live on at least one platform. Delete it there; removing it here would not retract it.'
    );
  }

  await prisma.socialPost.delete({ where: { id } });
  res.status(204).end();
}

/**
 * POST /api/social/posts/run-due — publishes scheduled posts that are due.
 *
 * The scheduler does this on its own now; this endpoint remains so an operator
 * can flush a backlog without waiting for the next tick. Both go through the
 * same claiming sweep, so pressing it while the scheduler is mid-run cannot
 * double-publish anything — the caller that loses the claim simply reports
 * fewer posts.
 */
export async function runDuePosts(req: Request, res: Response) {
  const { orgId, userId } = auth(req);

  const result = await publishDuePosts({ orgId, userId });

  res.json({
    processed: result.claimed,
    published: result.published,
    failed: result.failed,
  });
}

// --- Insights ---------------------------------------------------------------

/**
 * GET /api/social/insights
 *
 * Engagement as the platforms report it. Reads only what has been stored: a
 * page load must not trigger a dozen provider calls, so refreshing is either
 * the scheduler's job or an explicit POST below.
 *
 * Nothing here substitutes a zero for a figure a provider withheld. Each row
 * carries its own `unavailable` list, and a caller that wants to render "—"
 * instead of "0" has what it needs to tell the difference.
 */
export async function getInsights(req: Request, res: Response) {
  const { orgId } = auth(req);

  const [connections, targets] = await Promise.all([
    prisma.socialConnection.findMany({
      where: { orgId },
      include: { metrics: true },
      orderBy: [{ platform: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.socialPostTarget.findMany({
      where: { status: SocialPostStatus.Published, post: { orgId } },
      include: { connection: true, metrics: true, post: true },
      orderBy: { publishedAt: 'desc' },
      take: 40,
    }),
  ]);

  const accounts = connections.map((c) => ({
    connectionId: c.id,
    platform: c.platform,
    label: providerFor(c.platform).label,
    handle: c.handle,
    avatarUrl: c.avatarUrl ?? undefined,
    status: c.status,
    followers: c.metrics?.followers ?? null,
    postCount: c.metrics?.postCount ?? null,
    impressions28d: c.metrics?.impressions28d ?? null,
    unavailable: c.metrics?.unavailable ?? [],
    fetchedAt: c.metrics?.fetchedAt.toISOString() ?? null,
    fetchError: c.metrics?.fetchError ?? null,
  }));

  const posts = targets.map((t) => ({
    targetId: t.id,
    postId: t.postId,
    platform: t.connection.platform,
    handle: t.connection.handle,
    body: t.post.body,
    permalink: t.permalink,
    publishedAt: t.publishedAt?.toISOString() ?? null,
    impressions: t.metrics?.impressions ?? null,
    reach: t.metrics?.reach ?? null,
    likes: t.metrics?.likes ?? null,
    comments: t.metrics?.comments ?? null,
    shares: t.metrics?.shares ?? null,
    clicks: t.metrics?.clicks ?? null,
    engagementRate: t.metrics?.engagementRate ?? null,
    unavailable: t.metrics?.unavailable ?? [],
    fetchedAt: t.metrics?.fetchedAt.toISOString() ?? null,
    fetchError: t.metrics?.fetchError ?? null,
    /** True where the post is delivered but its figures were never fetched. */
    awaitingFirstFetch: !t.metrics,
  }));

  // Totals sum only what was actually reported. A platform that withholds
  // impressions must not drag the total towards zero, so the count of posts
  // each total is built from travels with it.
  const sum = (pick: (p: (typeof posts)[number]) => number | null) => {
    const values = posts.map(pick).filter((v): v is number => v !== null);
    return { value: values.reduce((a, b) => a + b, 0), fromPosts: values.length };
  };

  res.json({
    accounts,
    posts,
    totals: {
      posts: posts.length,
      followers: accounts.reduce((a, c) => a + (c.followers ?? 0), 0),
      impressions: sum((p) => p.impressions),
      reach: sum((p) => p.reach),
      engagements: sum((p) =>
        p.likes === null && p.comments === null && p.shares === null
          ? null
          : (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0)
      ),
    },
    oldestFetchedAt:
      posts.reduce<string | null>(
        (oldest, p) => (p.fetchedAt && (!oldest || p.fetchedAt < oldest) ? p.fetchedAt : oldest),
        null
      ) ?? null,
  });
}

/**
 * POST /api/social/insights/refresh
 *
 * Fetches from the providers now. Rate-limited by the staleness floor rather
 * than by the route alone: figures newer than SOCIAL_INSIGHTS_MAX_AGE_MINUTES
 * are left alone, so holding the button down costs nothing after the first
 * press. The response says how many rows were skipped for that reason, which
 * is more honest than reporting a refresh that did not happen.
 */
export async function refreshInsights(req: Request, res: Response) {
  const { orgId } = auth(req);

  const result = await refreshOrgInsights(orgId);

  res.json(result);
}

// --- Content ideas ----------------------------------------------------------

const ideasResult = z.object({
  ideas: z
    .array(
      z.object({
        text: z.string().min(1).max(400),
        rationale: z.string().min(1).max(300),
        suggestedPlatform: z.enum(['instagram', 'facebook', 'linkedin', 'x', 'any']),
      })
    )
    .min(1)
    .max(6),
});

/**
 * GET /api/social/ideas
 *
 * Content suggestions drawn from the tenant's own best-performing posts.
 *
 * This replaces a hardcoded `AI_IDEAS` array of four strings that claimed to
 * be trending. It is deliberately *not* a trends feed: this server has no
 * trend data source, and inventing one is how the panel it replaces came to
 * exist. What it does have is which of the customer's posts actually earned
 * engagement, which is a better basis for the next one anyway.
 *
 * With nothing published yet there is nothing to learn from, and the endpoint
 * says so instead of generating plausible filler.
 */
export async function contentIdeas(req: Request, res: Response) {
  const { orgId, userId } = auth(req);

  const performers = await prisma.socialPostMetric.findMany({
    where: { orgId, engagementRate: { not: null } },
    include: { target: { include: { post: true, connection: true } } },
    orderBy: { engagementRate: 'desc' },
    take: 8,
  });

  if (performers.length === 0) {
    return res.json({
      data: [],
      basis: 'none',
      reason:
        'No published post has engagement figures yet. Publish something and let the next insights refresh run, and suggestions will be based on what worked.',
    });
  }

  const resolved = await resolveAiCredential(orgId);
  if (!resolved.enabled) {
    throw serviceUnavailable(resolved.reason ?? 'AI features are unavailable.');
  }
  if (!resolved.credential.tenantFunded) {
    await assertWithinLimit(orgId, UsageKind.ai_request);
  }

  const digest = performers
    .map((m, i) => {
      const rate = m.engagementRate === null ? 'unknown' : `${(m.engagementRate * 100).toFixed(1)}%`;
      return [
        `${i + 1}. platform=${m.target.connection.platform}`,
        `engagement_rate=${rate}`,
        `likes=${m.likes ?? 'n/a'} comments=${m.comments ?? 'n/a'}`,
        `body="${m.target.post.body.slice(0, 220)}"`,
      ].join(' ');
    })
    .join('\n');

  const data = await generateJson(
    [
      'You advise an Indian B2B company on social content.',
      'Below are their best-performing posts, ranked by engagement rate, with',
      'the figures their platforms reported.',
      '',
      'Propose up to 5 ideas for their next posts. Ground every idea in a',
      'pattern visible in the data below - a subject, a format, a length, a',
      'platform - and say which pattern in the rationale. Do not claim',
      'knowledge of external trends: you have none.',
      '',
      asUntrustedInput('top_posts', digest),
      '',
      'Respond with JSON: {"ideas": [{"text": string, "rationale": string,',
      '"suggestedPlatform": "instagram"|"facebook"|"linkedin"|"x"|"any"}]}',
    ].join('\n'),
    ideasResult,
    resolved.credential
  );

  await record({ orgId, userId, apiKeyId: req.apiKeyId }, UsageKind.ai_request, {
    costPaise: resolved.costPaise,
    metadata: { operation: 'social-content-ideas', basedOn: performers.length },
  });

  res.json({
    data: data.ideas,
    basis: 'own_posts',
    basedOnPosts: performers.length,
  });
}
