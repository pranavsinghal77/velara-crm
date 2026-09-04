import crypto from 'crypto';
import { env } from '../config/env';
import { HttpError } from './httpError';

/**
 * Authenticated symmetric encryption for credentials we must be able to read
 * back: tenant AI keys, MCP bearer tokens, webhook signing secrets.
 *
 * These cannot be one-way hashed like a password, because the server needs the
 * original value to make the outbound call. AES-256-GCM is used so a tampered
 * ciphertext fails to decrypt rather than silently yielding garbage.
 *
 * Format: v1.<iv-b64url>.<tag-b64url>.<ciphertext-b64url>
 * The version prefix means the scheme can be rotated later without guessing
 * at what any given stored value was encrypted with.
 */

const VERSION = 'v1';
const IV_BYTES = 12;

function key(): Buffer {
  if (!env.ENCRYPTION_KEY) {
    throw new HttpError(
      500,
      'ENCRYPTION_KEY is not configured, so stored credentials cannot be read or written.',
      'encryption_unavailable'
    );
  }
  const raw = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  if (raw.length !== 32) {
    throw new HttpError(
      500,
      'ENCRYPTION_KEY must decode to exactly 32 bytes.',
      'encryption_misconfigured'
    );
  }
  return raw;
}

export const encryptionAvailable = () => Boolean(env.ENCRYPTION_KEY);

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decrypt(stored: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split('.');

  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new HttpError(500, 'Stored credential is malformed.', 'decryption_failed');
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key(),
      Buffer.from(ivB64, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Wrong key or tampered ciphertext. Never leak which.
    throw new HttpError(500, 'Stored credential could not be decrypted.', 'decryption_failed');
  }
}

/**
 * Last four characters, for showing which credential is stored without
 * revealing it. Short values are masked entirely.
 */
export function hint(plaintext: string): string {
  return plaintext.length <= 8 ? '****' : `****${plaintext.slice(-4)}`;
}
