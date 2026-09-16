import { describe, expect, it } from 'vitest';
import { authJourneyHref, journeyDestination, parseIntent } from './journey';
import { safeReturnPath } from './redirects';
describe('nonprivileged journey routing', () => {
  it('allowlists only passenger and driver intent', () => {
    for (const value of ['admin', 'support', { role: 'driver' }, '', null]) expect(parseIntent(value)).toBeNull();
    expect(parseIntent('driver')).toBe('driver');
    expect(parseIntent('passenger')).toBe('passenger');
  });
  it('routes driver login to the read-only resolver and preserves passenger booking context', () => {
    expect(journeyDestination('driver', '/admin')).toBe('/driver-application');
    expect(journeyDestination('passenger', '/book?partner_id=test')).toBe('/book?partner_id=test');
    expect(journeyDestination('passenger', '/driver-application')).toBe('/book');
    expect(journeyDestination(null)).toBe('/dashboard');
    expect(journeyDestination(null, '/organizations/example')).toBe('/organizations/example');
  });
  it('carries allowlisted context in shareable URLs without personal inputs', () => {
    const href = authJourneyHref('/login', 'driver', '/book?partner_id=test');
    const query = new URL(href, 'https://test.invalid').searchParams;
    expect(query.get('intent')).toBe('driver');
    expect(query.get('next')).toBe('/book?partner_id=test');
    expect(authJourneyHref('/login', 'admin', '//evil.invalid')).toBe('/login');
  });
  it('rejects callback loops, arbitrary paths, malformed and encoded external destinations', () => {
    for (const path of ['/auth/callback', '/auth/recovery/callback', '/login', '/unknown', '/%2f%2fevil.test', '/driver/%2e%2e/%2f%2fevil', '//evil.test', '/\\evil.test', 'https://evil.test', '/\nevil.test']) expect(safeReturnPath(path)).toBe('/dashboard');
  });
});
