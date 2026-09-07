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

import { safeReturnPath } from './redirects';
describe('safe booking and referral return links', () => {
  it('preserves local intent while rejecting external redirects', () => {
    expect(safeReturnPath('/book?partner_id=example')).toBe('/book?partner_id=example');
    for (const unsafe of ['//evil.example','/\\evil.example','https://evil.example','/\nevil.example',null]) expect(safeReturnPath(unsafe)).toBe('/dashboard');
  });
});
