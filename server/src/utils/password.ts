import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/**
 * Passwords are hashed with bcrypt at a configurable work factor. Plaintext
 * never reaches the database and never appears in a log line or API response.
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A dummy hash of a random value, used to make failed logins for unknown
 * emails cost the same as failed logins for known ones. Without this, response
 * timing tells an attacker which addresses are registered.
 */
const DUMMY_HASH = bcrypt.hashSync('velara-timing-equaliser', 10);

export async function equaliseTiming(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH);
}
