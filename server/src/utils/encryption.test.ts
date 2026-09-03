import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, encryptionAvailable, hint } from './encryption';

/**
 * Platform tokens must round-trip exactly and must fail loudly if tampered
 * with. These are the credentials that let Velara post as a customer, so a
 * silent corruption would mean publishing with a broken grant.
 */
describe('credential encryption', () => {
  it('is available in this environment', () => {
    expect(encryptionAvailable()).toBe(true);
  });

  it('round-trips a token exactly', () => {
    const token = 'EAAG.some-provider-token_with-punctuation/and+base64==';
    expect(decrypt(encrypt(token))).toBe(token);
  });

  it('produces a different ciphertext each time', () => {
    // A fresh IV per call, so identical tokens are not identifiable as such.
    expect(encrypt('same-token')).not.toBe(encrypt('same-token'));
  });

  it('carries a version prefix so the scheme can be rotated later', () => {
    expect(encrypt('x').startsWith('v1.')).toBe(true);
  });

  it('never leaves the plaintext in the stored value', () => {
    const stored = encrypt('super-secret-page-token');
    expect(stored).not.toContain('super-secret');
  });

  it('refuses a tampered ciphertext rather than returning garbage', () => {
    const stored = encrypt('token');
    const parts = stored.split('.');
    // Flip a character in the ciphertext segment.
    const flipped = parts[3]!.startsWith('A') ? `B${parts[3]!.slice(1)}` : `A${parts[3]!.slice(1)}`;
    expect(() => decrypt([parts[0], parts[1], parts[2], flipped].join('.'))).toThrow();
  });

  it('refuses a malformed value', () => {
    expect(() => decrypt('not-encrypted')).toThrow();
    expect(() => decrypt('v1.only.two')).toThrow();
  });

  it('masks a value down to its last four characters', () => {
    expect(hint('abcdefghijkl')).toBe('****ijkl');
    expect(hint('short')).toBe('****');
  });
});
