import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('produces a bcrypt hash, not the plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toContain('correct-horse');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('salts, so the same password hashes differently each time', async () => {
    const a = await hashPassword('same-password-twice');
    const b = await hashPassword('same-password-twice');
    expect(a).not.toBe(b);
  });

  it('verifies the correct password and rejects everything else', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    await expect(verifyPassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
    // The literal that used to be a universal backdoor.
    await expect(verifyPassword('redacted', hash)).resolves.toBe(false);
  });

  it('does not throw on a malformed stored hash', async () => {
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  });
});
