import { SocialConnectionStatus, SocialPostStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { publishDuePosts } from './delivery.service';
import { purgeOAuthStates, refreshAccessToken } from './oauth.service';
import { refreshOrgInsights } from './insights.service';

/**
 * The background worker the social feature was written to have and never got.
 *
 * `runDuePosts` carried the comment "Called by the scheduler" while nothing in
 * the process called it, so scheduling a post stored a row with a `scheduledAt`
 * and then waited for a human to press a button that only exists on the API.
 * The Content Calendar was, in effect, a diary.
 *
 * Three jobs, on separate clocks because they cost very different amounts:
 *
 *   - due posts, every minute: cheap, and lateness is visible to the customer
 *   - token upkeep, every 30 minutes: a handful of calls, and an expired token
 *     is only interesting hours before it matters
 *   - insights, every few hours: the expensive one, so it is also the one with
 *     a staleness floor
 *
 * Every job is wrapped so a throw inside it can never reach the interval
 * callback. An unhandled rejection there would take down the process, and
 * losing the API because a provider returned a 500 is a poor trade.
 */

const MINUTE = 60_000;

interface Job {
  name: string;
  intervalMs: number;
  run: () => Promise<string | null>;
}

/**
 * Guards against overlap. A sweep that takes longer than its interval would
 * otherwise be running alongside its own next tick, and two concurrent sweeps
 * of the same due posts is exactly the race the claim in `publishDuePosts`
 * exists to survive — no reason to create it deliberately as well.
 */
function guarded(job: Job): () => void {
  let inFlight = false;

  return () => {
    if (inFlight) {
      logger.debug(`Social scheduler: ${job.name} still running, skipping this tick`);
      return;
    }

    inFlight = true;
    job
      .run()
      .then((summary) => {
        if (summary) logger.info(`Social scheduler: ${summary}`);
      })
      .catch((err) => {
        logger.error(`Social scheduler: ${job.name} failed`, {
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        inFlight = false;
      });
  };
}

/** Publishes anything whose scheduled time has arrived. */
async function runDuePostsJob(): Promise<string | null> {
  const result = await publishDuePosts();
  if (result.claimed === 0) return null;

  return `published ${result.published} target(s) from ${result.claimed} scheduled post(s)` +
    (result.failed > 0 ? `, ${result.failed} failed` : '');
}

/**
 * Refreshes access tokens before they expire, and clears expired OAuth state.
 *
 * The window is deliberately wide. A token refreshed an hour before it dies
 * has one chance to succeed; refreshed a day before, it has many, and the
 * customer never sees a publish fail for a reason we could have fixed while
 * nobody was waiting.
 */
async function runTokenUpkeepJob(): Promise<string | null> {
  const horizon = new Date(Date.now() + 24 * 60 * MINUTE);

  const expiring = await prisma.socialConnection.findMany({
    where: {
      status: SocialConnectionStatus.Connected,
      expiresAt: { not: null, lte: horizon },
      refreshTokenEnc: { not: null },
    },
    select: { id: true, platform: true },
    take: 100,
  });

  let refreshed = 0;
  let failed = 0;

  for (const connection of expiring) {
    try {
      await refreshAccessToken(connection.id);
      refreshed += 1;
    } catch (err) {
      // refreshAccessToken already marks the connection Expired, which is what
      // prompts the reconnect in the UI. Nothing more to do here but count it.
      failed += 1;
      logger.warn('Social token refresh failed', {
        platform: connection.platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Single-use rows that were issued and never redeemed. `purgeOAuthStates`
  // was written for this and, like the scheduler itself, had no caller — so
  // the state table only ever grew.
  const purged = await purgeOAuthStates();

  if (refreshed === 0 && failed === 0 && purged === 0) return null;

  const parts: string[] = [];
  if (refreshed) parts.push(`refreshed ${refreshed} token(s)`);
  if (failed) parts.push(`${failed} refresh failure(s)`);
  if (purged) parts.push(`purged ${purged} stale OAuth state(s)`);
  return parts.join(', ');
}

/**
 * Pulls engagement figures for tenants that have published recently.
 *
 * Scoped to organisations with a post in the last 30 days: refreshing metrics
 * for an account nobody has posted from spends a provider's rate limit to
 * learn nothing. `maxAgeMinutes` then does the rest of the work — a tenant
 * whose figures were fetched by a user pressing Refresh five minutes ago costs
 * this sweep no calls at all.
 */
async function runInsightsJob(): Promise<string | null> {
  const since = new Date(Date.now() - 30 * 24 * 60 * MINUTE);

  const orgs = await prisma.socialPost.findMany({
    where: {
      status: { in: [SocialPostStatus.Published, SocialPostStatus.PartiallyPublished] },
      publishedAt: { gte: since },
    },
    select: { orgId: true },
    distinct: ['orgId'],
    take: 200,
  });

  let posts = 0;
  let accounts = 0;

  for (const { orgId } of orgs) {
    const result = await refreshOrgInsights(orgId, {
      maxAgeMinutes: env.SOCIAL_INSIGHTS_MAX_AGE_MINUTES,
    });
    posts += result.posts;
    accounts += result.accounts;
  }

  if (posts === 0 && accounts === 0) return null;
  return `refreshed insights for ${posts} post(s) and ${accounts} account(s) across ${orgs.length} tenant(s)`;
}

/**
 * Starts the worker. Returns a stop function for graceful shutdown.
 *
 * Off under `NODE_ENV=test` so a suite never reaches a provider, and off when
 * `SOCIAL_SCHEDULER=false` — which is how you run several API instances with
 * only one of them publishing, if you would rather not rely on the claim.
 */
export function startSocialScheduler(): () => void {
  if (env.isTest || !env.SOCIAL_SCHEDULER) {
    logger.info('Social scheduler disabled');
    return () => {};
  }

  const jobs: Job[] = [
    { name: 'due posts', intervalMs: env.SOCIAL_POLL_INTERVAL_MS, run: runDuePostsJob },
    { name: 'token upkeep', intervalMs: 30 * MINUTE, run: runTokenUpkeepJob },
    { name: 'insights', intervalMs: env.SOCIAL_INSIGHTS_INTERVAL_MINUTES * MINUTE, run: runInsightsJob },
  ];

  const timers = jobs.map((job) => {
    const tick = guarded(job);
    const timer = setInterval(tick, job.intervalMs);
    // Never hold the process open on this alone.
    timer.unref();
    return timer;
  });

  logger.info(
    `Social scheduler started: due posts every ${Math.round(env.SOCIAL_POLL_INTERVAL_MS / 1000)}s, ` +
      `insights every ${env.SOCIAL_INSIGHTS_INTERVAL_MINUTES}m`
  );

  return () => timers.forEach(clearInterval);
}
