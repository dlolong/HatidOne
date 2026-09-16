import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), set: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.create }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: mocks.set }) }));
import { createClient } from './server';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fictional.test'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'unit-public'); });
it('writes SDK session cookies in authenticated actions', async () => {
  await createClient({ requireCookieWrite: true });
  const adapter = mocks.create.mock.calls[0][2].cookies;
  adapter.setAll([{ name: 'unit-session', value: 'unit-value', options: { sameSite: 'lax' } }]);
  expect(mocks.set).toHaveBeenCalledWith('unit-session', 'unit-value', { sameSite: 'lax' });
});
it('fails visibly on an auth cookie write failure while preserving read-only component behavior', async () => {
  mocks.set.mockImplementation(() => { throw new Error('Cookie write failed'); });
  await createClient({ requireCookieWrite: true });
  expect(() => mocks.create.mock.calls[0][2].cookies.setAll([{ name: 'unit-session', value: 'unit' }])).toThrow('Cookie write failed');
  await createClient();
  expect(() => mocks.create.mock.calls[1][2].cookies.setAll([{ name: 'unit-session', value: 'unit' }])).not.toThrow();
});
