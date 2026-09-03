import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';
import { prisma } from './config/db';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { globalLimiter } from './middlewares/rateLimits';
import { createRealtimeServer } from './realtime';
import routes from './routes';
import { HttpError } from './utils/httpError';
import { logger } from './utils/logger';
import { purgeExpiredTokens } from './utils/tokens';

const app = express();
const httpServer = createServer(app);

// Client IPs drive rate limiting, so only believe X-Forwarded-For when we are
// actually behind a proxy that sets it.
if (env.TRUST_PROXY) app.set('trust proxy', 1);

const io = createRealtimeServer(httpServer);
app.set('io', io);

// --- Security & parsing -----------------------------------------------------

app.use(
  helmet({
    // This is a JSON API; it serves no HTML, so a restrictive CSP costs
    // nothing. (The old config disabled CSP entirely.)
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  })
);

app.use(
  cors({
    // Explicit allowlist instead of the previous wide-open `cors()`. Requests
    // with no Origin (server-to-server, curl, health checks) are allowed
    // through; browsers always send one.
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      callback(new HttpError(403, `Origin ${origin} is not allowed`, 'cors_rejected'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86_400,
  })
);

// Field-ops photo uploads are base64 data URLs, hence the raised ceiling; the
// per-field caps in the zod schemas are the real limit.
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

if (!env.isTest) {
  app.use(
    morgan(env.isProduction ? 'combined' : 'dev', {
      stream: { write: (message: string) => logger.info(message.trim()) },
      // Health checks would otherwise dominate the log.
      skip: (req) => req.path === '/health',
    })
  );
}

app.use('/api', globalLimiter);

// --- Public endpoints -------------------------------------------------------

app.get('/', (_req, res) => {
  res.json({
    service: 'Velara CRM API',
    version: '1.0.0',
    status: 'ok',
    docs: '/api/auth/login',
  });
});

/**
 * Health check. Reports the real database state instead of the previous
 * version, which caught every error and reported "Connected" with a
 * hardcoded lead count of 12 regardless.
 */
app.get('/health', async (_req, res) => {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      uptime: Math.round(process.uptime()),
      database: { status: 'connected', latencyMs: Date.now() - started },
      ai: env.aiEnabled ? 'configured' : 'disabled',
    });
  } catch (err) {
    logger.error('Health check failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(503).json({
      status: 'unhealthy',
      uptime: Math.round(process.uptime()),
      database: { status: 'unreachable' },
    });
  }
});

// --- API --------------------------------------------------------------------

app.use('/api', routes);

app.use((req, _res, next) => {
  next(new HttpError(404, `Cannot ${req.method} ${req.originalUrl}`, 'not_found'));
});

app.use(errorHandler);

// --- Lifecycle --------------------------------------------------------------

const server = httpServer.listen(env.PORT, () => {
  logger.info(
    `Velara CRM API listening on :${env.PORT} [${env.NODE_ENV}] ` +
      `cors=${env.corsOrigins.join(',') || 'none'} ai=${env.aiEnabled ? 'on' : 'off'}`
  );
});

// Revoked and expired refresh tokens accumulate forever otherwise.
const tokenCleanup = setInterval(
  () => {
    purgeExpiredTokens()
      .then((n) => n > 0 && logger.debug(`Purged ${n} expired refresh tokens`))
      .catch((err) => logger.error('Token purge failed', { error: String(err) }));
  },
  6 * 60 * 60 * 1000
);
tokenCleanup.unref();

/**
 * Graceful shutdown: stop accepting connections, close sockets, then release
 * the database pool. Without this, a redeploy can drop in-flight requests and
 * leak Postgres connections.
 */
async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  clearInterval(tokenCleanup);

  const timeout = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
  timeout.unref();

  try {
    io.close();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    await prisma.$disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: String(err) });
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  void shutdown('uncaughtException');
});

export { app, io };
