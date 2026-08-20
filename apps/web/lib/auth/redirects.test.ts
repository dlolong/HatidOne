import { describe, expect, it } from 'vitest';
import { authCallbackUrl } from './redirects';

describe('auth callback URL', () => {
  it('builds the callback from the configured trusted origin', () => {
    expect(authCallbackUrl('https://hatidone.example/some/path')).toBe(
      'https://hatidone.example/auth/callback',
    );
  });

  it('rejects missing, malformed, and non-HTTP origins', () => {
    expect(authCallbackUrl(undefined)).toBeNull();
    expect(authCallbackUrl('not a URL')).toBeNull();
    expect(authCallbackUrl('javascript:alert(1)')).toBeNull();
    expect(authCallbackUrl('https://user:password@hatidone.example')).toBeNull();
  });
});
