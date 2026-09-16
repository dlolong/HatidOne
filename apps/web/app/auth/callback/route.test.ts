import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ create: vi.fn(), exchange: vi.fn(), getUser: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.create }));
import { GET } from './route';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://configured.example.test');
  mocks.create.mockResolvedValue({ auth: { exchangeCodeForSession: mocks.exchange, getUser: mocks.getUser }, rpc: mocks.rpc });
  mocks.exchange.mockResolvedValue({ data: { session: { user: { id: 'test' } }, redirectType: 'signup' }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'test' } }, error: null });
});
it('uses configured origin, verified identity, and read-only resolver on confirmation', async () => {
  const response = await GET(new NextRequest('https://untrusted.example/auth/callback?code=test&intent=driver&next=//evil.test&sb_flow_id=test-flow'));
  expect(response.headers.get('location')).toBe('https://configured.example.test/driver-application');
  expect(mocks.exchange).toHaveBeenCalledWith('test', { flowId: 'test-flow' });
  expect(mocks.getUser).toHaveBeenCalledOnce();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});
it('retains driver intent on missing, expired, replayed and cross-browser links', async () => {
  mocks.exchange.mockResolvedValue({ data: { session: null }, error: { message: 'private PKCE failure' } });
  for (const suffix of ['?intent=driver', '?intent=driver&code=expired']) {
    const response = await GET(new NextRequest(`https://untrusted.example/auth/callback${suffix}`));
    const target = new URL(response.headers.get('location')!);
    expect(target.origin).toBe('https://configured.example.test');
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('intent')).toBe('driver');
    expect(target.searchParams.get('error')).toContain('another browser');
    expect(target.searchParams.has('code')).toBe(false);
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('refuses missing verified identity and never treats recovery as signup', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET(new NextRequest('https://test.invalid/auth/callback?code=test&intent=driver'))).headers.get('location')).toContain('/login?intent=driver');
  mocks.exchange.mockResolvedValue({ data: { session: {}, redirectType: 'recovery' }, error: null });
  expect((await GET(new NextRequest('https://test.invalid/auth/callback?code=test'))).headers.get('location')).toContain('/login?error=');
});
it('preserves safe passenger booking and organization return destinations', async () => {
  for (const [query, path] of [['intent=passenger&next=%2Fbook%3Fpartner_id%3Dtest', '/book?partner_id=test'], ['next=%2Forganizations%2Ftest', '/organizations/test'], ['next=%2Fauth%2Fcallback', '/dashboard']]) {
    expect((await GET(new NextRequest(`https://test.invalid/auth/callback?code=test&${query}`))).headers.get('location')).toBe(`https://configured.example.test${path}`);
  }
});
