import { SocialPlatform } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  ALL_PROVIDERS,
  describeProvider,
  isConfigured,
  missingEnv,
  providerFor,
  redirectUri,
} from './providers';

/**
 * These lock in the property that made the old Integrations screen dishonest:
 * availability must be derived from whether credentials actually exist, never
 * asserted.
 */
describe('social provider registry', () => {
  it('covers every platform in the schema', () => {
    const covered = ALL_PROVIDERS.map((p) => p.platform).sort();
    expect(covered).toEqual(Object.values(SocialPlatform).sort());
  });

  it('reports a platform as unconfigured when the server holds no credentials', () => {
    // The test env sets no provider secrets, so every platform must decline.
    for (const platform of Object.values(SocialPlatform)) {
      expect(isConfigured(platform)).toBe(false);
      expect(missingEnv(platform).length).toBeGreaterThan(0);
    }
  });

  it('names the exact env vars an operator has to set', () => {
    expect(missingEnv(SocialPlatform.facebook)).toEqual(['META_APP_ID', 'META_APP_SECRET']);
    expect(missingEnv(SocialPlatform.linkedin)).toEqual([
      'LINKEDIN_CLIENT_ID',
      'LINKEDIN_CLIENT_SECRET',
    ]);
    expect(missingEnv(SocialPlatform.x)).toEqual(['X_CLIENT_ID', 'X_CLIENT_SECRET']);
  });

  it('never exposes a client secret through the public description', () => {
    for (const platform of Object.values(SocialPlatform)) {
      const described = JSON.stringify(describeProvider(platform));
      expect(described).not.toContain('clientSecret');
      expect(described).not.toContain('clientId');
    }
  });

  it('builds the redirect URI from configuration, not the request', () => {
    // A redirect_uri derived from the Host header is attacker-influenced and
    // would not match what is registered with the provider.
    expect(redirectUri(SocialPlatform.instagram)).toBe(
      'http://localhost:3001/api/social/callback/instagram'
    );
  });

  describe('capabilities match each platform', () => {
    it('requires an image for Instagram, which has no text-only post type', () => {
      expect(providerFor(SocialPlatform.instagram).capabilities.imageRequired).toBe(true);
      expect(providerFor(SocialPlatform.facebook).capabilities.imageRequired).toBe(false);
    });

    it('caps X at 280 characters', () => {
      expect(providerFor(SocialPlatform.x).capabilities.maxChars).toBe(280);
    });

    it('marks WhatsApp as a messaging channel, not a feed', () => {
      expect(providerFor(SocialPlatform.whatsapp).capabilities.messaging).toBe(true);
      // Every other platform is a feed.
      for (const platform of Object.values(SocialPlatform)) {
        if (platform === SocialPlatform.whatsapp) continue;
        expect(providerFor(platform).capabilities.messaging).toBe(false);
      }
    });
  });

  it('requests PKCE only where the provider requires it', () => {
    expect(providerFor(SocialPlatform.x).usesPkce).toBe(true);
    expect(providerFor(SocialPlatform.facebook).usesPkce).toBe(false);
  });
});
