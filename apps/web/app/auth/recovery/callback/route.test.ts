import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), getUser: vi.fn(), clear: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/supabase/recovery', () => ({ createRecoveryClient: mocks.create, clearRecoveryCookies: mocks.clear }));
vi.mock('@/lib/auth/redirects', () => ({ authCallbackUrl: () => 'https://staging.example.test/auth/callback' }));
import { GET } from './route';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ auth: { exchangeCodeForSession: mocks.exchange, getUser: mocks.getUser } });
  mocks.exchange.mockResolvedValue({ data: { redirectType: 'recovery' }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'verified-owner' } }, error: null });
});
it('requires a verified PKCE recovery flow and strips code/flow/next from its fixed trusted redirect', async () => {
  const result = await GET(new NextRequest('https://evil.example/auth/recovery/callback?code=fictional-code&sb_flow_id=fictional-flow&next=https://evil.example'));
  expect(mocks.exchange).toHaveBeenCalledWith('fictional-code', { flowId: 'fictional-flow' });
  expect(mocks.getUser).toHaveBeenCalledOnce();
  expect(result.headers.get('location')).toBe('https://staging.example.test/reset-password');
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(result.headers.get('referrer-policy')).toBe('no-referrer');
});
it('rejects missing or replayed/expired code and removes recovery cookies', async () => {
  const missing = await GET(new NextRequest('https://staging.example.test/auth/recovery/callback'));
  expect(missing.headers.get('location')).toContain('/forgot-password?error=');
  expect(mocks.exchange).not.toHaveBeenCalled();
  mocks.exchange.mockResolvedValue({ data: { redirectType: null }, error: { message: 'expired-code' } });
  const expired = await GET(new NextRequest('https://staging.example.test/auth/recovery/callback?code=fictional-expired'));
  expect(expired.headers.get('location')).toContain('/forgot-password?error=');
  expect(expired.headers.get('location')).not.toContain('fictional-expired');
  expect(mocks.clear).toHaveBeenCalledTimes(2);
});
it('a regular signin code or an unverified identity cannot authorize password recovery', async () => {
  mocks.exchange.mockResolvedValue({ data: { redirectType: null }, error: null });
  expect((await GET(new NextRequest('https://staging.example.test/auth/recovery/callback?code=ordinary'))).headers.get('location')).toContain('/forgot-password?error=');
  expect(mocks.getUser).not.toHaveBeenCalled();
  mocks.exchange.mockResolvedValue({ data: { redirectType: 'recovery' }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'untrusted' } }, error: { message: 'revoked' } });
  expect((await GET(new NextRequest('https://staging.example.test/auth/recovery/callback?code=revoked'))).headers.get('location')).toContain('/forgot-password?error=');
});
it('clears scoped credentials and fails closed when the exchange throws, without leaking a code or error', async () => {
  mocks.exchange.mockRejectedValue(new Error('fictional-private-provider-diagnostic'));
  const response = await GET(new NextRequest('https://staging.example.test/auth/recovery/callback?code=fictional-secret-code&next=//evil.example'));
  const target = response.headers.get('location') ?? '';
  expect(target).toMatch(/^https:\/\/staging\.example\.test\/forgot-password\?error=/);
  expect(target).not.toContain('fictional-secret-code');
  expect(target).not.toContain('fictional-private-provider-diagnostic');
  expect(mocks.clear).toHaveBeenCalledOnce();
  expect(mocks.getUser).not.toHaveBeenCalled();
});
it('a recovery exchange with no verified user does not open the reset form', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const response = await GET(new NextRequest('https://staging.example.test/auth/recovery/callback?code=fictional-code'));
  expect(response.headers.get('location')).toContain('/forgot-password?error=');
  expect(mocks.clear).toHaveBeenCalledOnce();
});
it('preserves only allowlisted journey on successful and failed recovery links', async () => {
  const success = await GET(new NextRequest('https://evil.test/auth/recovery/callback?code=test&intent=driver&next=//evil.test'));
  expect(success.headers.get('location')).toBe('https://staging.example.test/reset-password?intent=driver');
  const failed = await GET(new NextRequest('https://evil.test/auth/recovery/callback?intent=driver'));
  expect(failed.headers.get('location')).toContain('/forgot-password?intent=driver&error=');
  const forged = await GET(new NextRequest('https://evil.test/auth/recovery/callback?code=test&intent=admin'));
  expect(forged.headers.get('location')).toBe('https://staging.example.test/reset-password');
});
