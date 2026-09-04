import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

/**
 * Environment is validated once, at boot. A misconfigured deployment fails
 * loudly here instead of silently degrading into an insecure state later
 * (which is how the previous build ended up with a public API and an
 * unauthenticated seed endpoint).
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /**
   * Postgres schema holding the tables. Prisma's `?schema=` URL parameter is
   * ignored when a driver adapter is in use, so it has to be passed to the
   * adapter explicitly - see config/db.ts.
   */
  DB_SCHEMA: z.string().min(1).default('public'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),

  /**
   * 32 bytes, base64. Encrypts stored credentials (tenant AI keys, MCP tokens,
   * webhook secrets). Optional so an install with none of those features still
   * boots; the encryption helpers fail loudly if something needs it.
   * Generate: openssl rand -base64 32
   */
  ENCRYPTION_KEY: z.string().default(''),

  /** Billing. Leave blank to run the metering and plan logic without Stripe. */
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_API_BASE: z.string().default('https://api.stripe.com'),

  /**
   * Public origin of this API, used to build OAuth redirect URIs. Derived from
   * configuration rather than the incoming request, because a redirect_uri
   * taken from the Host header is attacker-influenced and must match what is
   * registered with each provider exactly.
   */
  PUBLIC_API_URL: z.string().default('http://localhost:3001'),
  /** Where to send the browser back to after an OAuth round trip. */
  PUBLIC_APP_URL: z.string().default('http://localhost:5173'),

  /* Social providers. Each is optional; a platform with no credentials
     reports itself as unavailable instead of pretending to be connected.
     Instagram, Facebook and WhatsApp all authenticate through one Meta app. */
  META_APP_ID: z.string().default(''),
  META_APP_SECRET: z.string().default(''),
  LINKEDIN_CLIENT_ID: z.string().default(''),
  LINKEDIN_CLIENT_SECRET: z.string().default(''),
  X_CLIENT_ID: z.string().default(''),
  X_CLIENT_SECRET: z.string().default(''),

  /**
   * The background worker that publishes scheduled posts, keeps OAuth tokens
   * alive and refreshes engagement figures. On by default: without it a
   * scheduled post is never published, which is worse than the cost of the
   * poll. Turn it off on all but one instance if you would rather not rely on
   * the claim in `publishDuePosts` to keep several from racing.
   */
  SOCIAL_SCHEDULER: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),
  /** How often to look for scheduled posts that are due. */
  SOCIAL_POLL_INTERVAL_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
  /** How often to sweep engagement figures for tenants that posted recently. */
  SOCIAL_INSIGHTS_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(1_440).default(360),
  /**
   * Staleness floor. Figures fetched more recently than this are left alone,
   * whether the request came from the scheduler or from a user pressing
   * Refresh — which is what stops a held-down button from spending a
   * provider's rate limit.
   */
  SOCIAL_INSIGHTS_MAX_AGE_MINUTES: z.coerce.number().int().min(1).max(1_440).default(15),

  GEMINI_API_KEY: z.string().default(''),
  /**
   * Model ids are pinned, not aliased.
   *
   * `gemini-2.5-flash` was the default and is now retired: a key issued after
   * its cutoff gets `404 ... no longer available to new users` on every call,
   * which is what took the assistant down while /ai/status still reported
   * itself available.
   *
   * Google's 404 recommends gemini-3.6-flash, and that does work — but
   * measured against this key it spent 1545 tokens thinking and took 31s to
   * answer a chat prompt, and its thinking cannot be switched off
   * (`thinkingBudget: 0` comes back as an invalid argument). Half a minute is
   * not a chat response. The lite tier does no thinking at all by default: it
   * answered the same prompt in 2.4s at a comparable length, and read an
   * image in 5.7s where 3.6-flash took 24.6s. Swap in a larger model if you
   * would rather have the quality than the latency.
   *
   * Deliberately not `gemini-flash-latest`. An alias silently changes the
   * model under a deployment, and several endpoints here depend on structured
   * JSON matching a zod schema — that is not something to let drift without a
   * deploy. Check `GET /ai/status` after changing it.
   */
  GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),
  GEMINI_VISION_MODEL: z.string().default('gemini-3.1-flash-lite'),
  /**
   * Ceiling for one provider call. Was a hardcoded 20s, which the newer
   * models exceed regularly: the model above answers text in about 2s but
   * took 15.6s for a JSON completion, and a thinking model took 31s. A
   * timeout shorter than the model is slow is indistinguishable from an
   * outage, so this leaves real headroom rather than sitting on the measured
   * figure.
   */
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(180_000).default(45_000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  console.error(
    `\nInvalid server environment. Copy .env.example to .env and fill it in.\n${details}\n`
  );
  process.exit(1);
}

const raw = parsed.data;

if (raw.JWT_ACCESS_SECRET === raw.JWT_REFRESH_SECRET) {
  console.error('\nJWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.\n');
  process.exit(1);
}

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  aiEnabled: raw.GEMINI_API_KEY.length > 0,
  encryptionEnabled: raw.ENCRYPTION_KEY.length > 0,
  billingEnabled: raw.STRIPE_SECRET_KEY.length > 0,
} as const;

export type Env = typeof env;
