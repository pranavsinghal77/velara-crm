import { describe, expect, it } from 'vitest';
import { decodeDataUrl, humanSize } from './document.controller';

describe('document payload decoding', () => {
  it('reports the decoded byte length, not the encoded string length', () => {
    // Base64 inflates by about a third. Storing the string length would
    // overstate every file and mis-bill storage.
    const text = 'Velara CRM master services agreement.';
    const encoded = Buffer.from(text, 'utf8').toString('base64');

    const decoded = decodeDataUrl(`data:text/plain;base64,${encoded}`);

    expect(decoded.bytes).toBe(text.length);
    expect(decoded.bytes).toBeLessThan(encoded.length);
  });

  it('extracts the mime type', () => {
    expect(decodeDataUrl('data:application/pdf;base64,JVBERi0=').mimeType).toBe(
      'application/pdf'
    );
    expect(decodeDataUrl('data:image/svg+xml;base64,PHN2Zz4=').mimeType).toBe('image/svg+xml');
  });

  it('round-trips the payload so stored bytes match what was uploaded', () => {
    const original = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const decoded = decodeDataUrl(`data:image/png;base64,${original.toString('base64')}`);

    expect(Buffer.from(decoded.base64, 'base64').equals(original)).toBe(true);
    expect(decoded.bytes).toBe(original.byteLength);
  });

  it('rejects anything that is not a base64 data URL', () => {
    expect(() => decodeDataUrl('https://example.com/file.pdf')).toThrow();
    expect(() => decodeDataUrl('not-a-url')).toThrow();
    expect(() => decodeDataUrl('data:text/plain,plain-not-base64')).toThrow();
    expect(() => decodeDataUrl('')).toThrow();
  });
});

describe('humanSize', () => {
  it('scales the unit to the magnitude', () => {
    expect(humanSize(95)).toBe('95 B');
    expect(humanSize(2048)).toBe('2 KB');
    expect(humanSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('handles the boundaries', () => {
    expect(humanSize(0)).toBe('0 B');
    expect(humanSize(1023)).toBe('1023 B');
    expect(humanSize(1024)).toBe('1 KB');
    expect(humanSize(1024 * 1024)).toBe('1.0 MB');
  });
});
