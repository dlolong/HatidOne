import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), set: vi.fn(), remove: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.create }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [{ name: 'sb-normal-auth-token', value: 'fictional-normal' }, { name: 'hatidone-recovery.0', value: 'fictional-recovery' }, { name: 'hatidone-recovery-code-verifier', value: 'fictional-verifier' }], set: mocks.set, delete: mocks.remove }) }));
vi.mock('./env', () => ({ getSupabaseEnvironment: () => ({ url: 'https://fictional.supabase.co', anonKey: 'public-fictional' }) }));
import { createRecoveryClient, clearRecoveryCookies } from './recovery';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.example.test'); });
it('isolates recovery from ordinary cookies and limits browser exposure/lifetime', async () => {
  await createRecoveryClient();
  const options = mocks.create.mock.calls[0][2];
  expect(options.cookieOptions).toMatchObject({ name: 'hatidone-recovery', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 900 });
  expect(options.cookies.getAll().map((cookie: { name: string }) => cookie.name)).toEqual(['hatidone-recovery.0', 'hatidone-recovery-code-verifier']);
});
it('clears only recovery cookies and preserves the normal signed-in account', async () => {
  await clearRecoveryCookies();
  expect(mocks.remove.mock.calls.map(call => call[0])).toEqual(['hatidone-recovery.0', 'hatidone-recovery-code-verifier']);
});

it('overrides the SDK persistence defaults at the write boundary and preserves removals', async () => {
  await createRecoveryClient();
  const options = mocks.create.mock.calls[0][2];
  options.cookies.setAll([
    { name: 'hatidone-recovery.0', value: 'fictional-recovery', options: { maxAge: 400 * 24 * 60 * 60, httpOnly: false, secure: false, sameSite: 'none' } },
    { name: 'hatidone-recovery.1', value: '', options: { maxAge: 0 } },
  ]);
  expect(mocks.set).toHaveBeenNthCalledWith(1, 'hatidone-recovery.0', 'fictional-recovery', expect.objectContaining({ maxAge: 900, httpOnly: true, secure: true, sameSite: 'lax', path: '/' }));
  expect(mocks.set).toHaveBeenNthCalledWith(2, 'hatidone-recovery.1', '', expect.objectContaining({ maxAge: 0 }));
});

it('uses parsed HTTPS protocol, including uppercase schemes, for persisted cookie security', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'HTTPS://staging.example.test');
  await createRecoveryClient();
  const options = mocks.create.mock.calls[0][2];
  options.cookies.setAll([{ name: 'hatidone-recovery', value: 'fictional', options: {} }]);
  expect(options.cookieOptions.secure).toBe(true);
  expect(mocks.set).toHaveBeenCalledWith('hatidone-recovery', 'fictional', expect.objectContaining({ secure: true }));
});
