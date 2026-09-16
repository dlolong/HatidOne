import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ create: vi.fn(), getUser: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.create }));
import { updateSession } from './proxy';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fictional.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fictional-public-key');
  mocks.create.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user: null } });
});
it('routes signed-out application visits to driver signup and booking to passenger login', async () => {
  for (const route of ['/driver-application', '/driver/onboarding']) {
    expect((await updateSession(new NextRequest(`https://test.invalid${route}`))).headers.get('location')).toBe('https://test.invalid/signup?intent=driver');
  }
  const response = await updateSession(new NextRequest('https://test.invalid/book?partner_id=test'));
  const target = new URL(response.headers.get('location')!);
  expect(target.pathname).toBe('/login');
  expect(target.searchParams.get('intent')).toBe('passenger');
  expect(target.searchParams.get('next')).toBe('/book?partner_id=test');
});
it('honors signed-in driver and passenger context without stale preferences', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'same-account' } } });
  for (const [route, target] of [['/signup?intent=driver', '/driver-application'], ['/login?intent=passenger&next=%2Fbook', '/book'], ['/login', '/dashboard']]) {
    expect((await updateSession(new NextRequest(`https://test.invalid${route}`))).headers.get('location')).toBe(`https://test.invalid${target}`);
  }
});
it('does not authenticate or create records when viewing marketing pages', async () => {
  await updateSession(new NextRequest('https://test.invalid/drivers'));
  await updateSession(new NextRequest('https://test.invalid/'));
  expect(mocks.create).not.toHaveBeenCalled();
});
it('carries refreshed session cookies into redirects', async () => {
  mocks.create.mockImplementation((_url, _key, options) => {
    options.cookies.setAll([{ name: 'test-session', value: 'fictional', options: { httpOnly: true } }]);
    return { auth: { getUser: mocks.getUser } };
  });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'test' } } });
  const response = await updateSession(new NextRequest('https://test.invalid/signup?intent=driver'));
  expect(response.cookies.get('test-session')?.value).toBe('fictional');
});
