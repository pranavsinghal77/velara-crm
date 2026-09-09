import { env } from '../config/env';

/**
 * Structured, level-filtered logging.
 *
 * The redaction pass matters: request bodies and error metadata flow through
 * here, and the previous logger printed whatever it was handed - which on a
 * failed login meant the submitted password ended up in the log.
 */

type Level = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_ORDER: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };

const threshold: number = env.isTest
  ? LEVEL_ORDER.error
  : env.isProduction
    ? LEVEL_ORDER.info
    : LEVEL_ORDER.debug;

const SENSITIVE_KEYS = /^(password|newPassword|currentPassword|passwordHash|token|accessToken|refreshToken|authorization|cookie|apiKey|secret)$/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.test(key) ? '[redacted]' : redact(val, depth + 1);
  }
  return out;
}

function emit(level: Level, message: string, meta?: unknown) {
  if (LEVEL_ORDER[level] > threshold) return;

  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta !== undefined ? { meta: redact(meta) } : {}),
  };

  // Structured JSON in production so a log aggregator can parse it; readable
  // text locally.
  const write = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (env.isProduction) {
    write(JSON.stringify(line));
  } else {
    write(`[${level.toUpperCase()}] ${message}`, meta !== undefined ? redact(meta) : '');
  }
}

export const logger = {
  error: (message: string, meta?: unknown) => emit('error', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  debug: (message: string, meta?: unknown) => emit('debug', message, meta),
};
