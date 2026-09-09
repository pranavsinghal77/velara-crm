import { SocialConnectionStatus, SocialPostStatus, UsageKind } from '@prisma/client';
import { prisma } from '../config/db';
import { record } from '../billing/usage.service';
import { logger } from '../utils/logger';
import { publishTo } from './publish.service';

/**
 * The single path a post takes to the platforms.
 *
 * This used to be a private function inside social.controller.ts, which meant
 * the only way to publish anything was to be an HTTP request. The scheduler
 * that `runDuePosts` documents itself as being called by could not exist,
 * because a background worker has no `req` to hand it — so it did not exist,
 * and a scheduled post sat at `Scheduled` until an admin pressed something.
 *
 * Everything that publishes goes through here now, for the same reason lead
 * creation goes through one service: the metering, the connection health
 * updates and the retry accounting cannot be skipped depending on which entry
 * point a caller happened to use.
 */

/**
 * A target that has failed this many times is left alone.
 *
 * Without a cap, `deliverPost` retries every non-published target on every
 * run, so a post rejected for a permanent reason — a body over the platform's
 * character limit, a revoked permission — would be re-attempted every minute
 * for as long as the server ran, burning rate limit against a call that cannot
 * succeed.
 */
export const MAX_ATTEMPTS = 3;

export interface DeliveryOutcome {
  status: SocialPostStatus;
  published: number;
  failed: number;
  /** Targets left untouched because they had already used their attempts. */
  exhausted: number;
}

/**
 * Sends one post to each of its pending targets.
 *
 * Targets are independent: one platform rejecting the content does not stop the
 * others, and the post ends up Published, PartiallyPublished or Failed
 * according to what actually happened.
 */
export async function deliverPost(params: {
  postId: string;
  orgId: string;
  /** Null for a scheduler run: no human pressed anything. */
  userId: string | null;
}): Promise<DeliveryOutcome> {
  const { postId, orgId, userId } = params;

  const post = await prisma.socialPost.findUniqueOrThrow({
    where: { id: postId },
    include: { targets: { include: { connection: true } } },
  });

  const pending = post.targets.filter((t) => t.status !== SocialPostStatus.Published);
  const deliverable = pending.filter((t) => t.attempts < MAX_ATTEMPTS);
  const exhausted = pending.length - deliverable.length;

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: SocialPostStatus.Publishing },
  });

  for (const target of deliverable) {
    try {
      const result = await publishTo(target.connection, {
        body: post.body,
        mediaUrl: post.mediaUrl,
      });

      await prisma.$transaction([
        prisma.socialPostTarget.update({
          where: { id: target.id },
          data: {
            status: SocialPostStatus.Published,
            externalPostId: result.externalPostId,
            permalink: result.permalink ?? null,
            error: null,
            attempts: { increment: 1 },
            publishedAt: new Date(),
          },
        }),
        prisma.socialConnection.update({
          where: { id: target.connectionId },
          data: {
            lastPublishAt: new Date(),
            // A successful publish is proof the grant is healthy, so clear a
            // stale Error left by an earlier failure.
            ...(target.connection.status === SocialConnectionStatus.Error
              ? { status: SocialConnectionStatus.Connected, statusDetail: null }
              : {}),
          },
        }),
      ]);

      await record({ orgId, userId: userId ?? undefined }, UsageKind.message_sent, {
        metadata: {
          channel: target.connection.platform,
          kind: 'social_post',
          via: userId ? 'user' : 'scheduler',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publish failed';
      const attempts = target.attempts + 1;

      await prisma.socialPostTarget.update({
        where: { id: target.id },
        data: {
          status: SocialPostStatus.Failed,
          error:
            attempts >= MAX_ATTEMPTS
              ? `${message} (gave up after ${attempts} attempts)`
              : message,
          attempts,
        },
      });

      // An auth failure is about the connection, not this post; mark it so the
      // UI prompts a reconnect instead of letting every future post fail.
      if (/reconnect|revoked|permission denied|rejected the request/i.test(message)) {
        await prisma.socialConnection.update({
          where: { id: target.connectionId },
          data: { status: SocialConnectionStatus.Expired, statusDetail: message },
        });
      }

      logger.warn('Social publish target failed', {
        postId,
        platform: target.connection.platform,
        attempts,
        error: message,
      });
    }
  }

  const after = await prisma.socialPostTarget.findMany({ where: { postId } });
  const published = after.filter((t) => t.status === SocialPostStatus.Published);

  const status =
    published.length === after.length
      ? SocialPostStatus.Published
      : published.length === 0
        ? SocialPostStatus.Failed
        : SocialPostStatus.PartiallyPublished;

  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      status,
      // The earliest success, not "now": a retry of one failed target must not
      // restamp a post that went live on another platform hours ago.
      publishedAt:
        published.length > 0
          ? (post.publishedAt ??
            published.reduce<Date>(
              (earliest, t) =>
                t.publishedAt && t.publishedAt < earliest ? t.publishedAt : earliest,
              new Date()
            ))
          : null,
    },
  });

  return {
    status,
    published: published.length,
    failed: after.length - published.length,
    exhausted,
  };
}

/**
 * Publishes scheduled posts that are due.
 *
 * Each post is claimed with a conditional update before any provider call.
 * That check is the whole point: two workers, or the scheduler racing an admin
 * pressing "run due", would otherwise both read the same `Scheduled` row and
 * both publish it — and a duplicate post on a customer's live Facebook page is
 * not something an apology fixes. `updateMany` on a status that is part of the
 * filter is atomic in Postgres, so exactly one caller sees `count === 1`.
 *
 * `orgId` narrows the sweep to one tenant for the manual endpoint; the
 * scheduler omits it and sweeps every tenant.
 */
export async function publishDuePosts(params: {
  orgId?: string;
  userId?: string | null;
  limit?: number;
} = {}): Promise<{ claimed: number; published: number; failed: number }> {
  const { orgId, userId = null, limit = 50 } = params;

  const due = await prisma.socialPost.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      status: SocialPostStatus.Scheduled,
      scheduledAt: { lte: new Date() },
    },
    select: { id: true, orgId: true },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
  });

  let claimed = 0;
  let published = 0;
  let failed = 0;

  for (const post of due) {
    const claim = await prisma.socialPost.updateMany({
      where: { id: post.id, status: SocialPostStatus.Scheduled },
      data: { status: SocialPostStatus.Publishing },
    });

    // Someone else got there first. Not an error, and not something to log as
    // one — under two workers this is the expected outcome half the time.
    if (claim.count !== 1) continue;

    claimed += 1;

    try {
      const outcome = await deliverPost({ postId: post.id, orgId: post.orgId, userId });
      published += outcome.published;
      failed += outcome.failed;
    } catch (err) {
      failed += 1;
      // The claim left the post at `Publishing`. Put it back to Failed so it
      // is visible rather than stuck in a state nothing will ever move it out
      // of.
      await prisma.socialPost
        .update({ where: { id: post.id }, data: { status: SocialPostStatus.Failed } })
        .catch(() => {});

      logger.error('Scheduled social post could not be delivered', {
        postId: post.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { claimed, published, failed };
}
