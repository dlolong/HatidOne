import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), profile: vi.fn(), config: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));
import { GET } from './route';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'fictional-user' } }, error: null });
  mocks.profile.mockResolvedValue({ data: { role: 'admin', account_status: 'active' } });
  mocks.config.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => table === 'profiles'
    ? { select: () => ({ eq: () => ({ single: mocks.profile }) }) }
    : { select: () => ({ single: mocks.config }) });
});
it('rejects anonymous readiness and does not inspect protected configuration', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const response = await GET();
  expect(response.status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toBe('no-store');
});
it('rejects non-admin and suspended administrator', async () => {
  for (const profile of [{ role: 'passenger', account_status: 'active' }, { role: 'admin', account_status: 'suspended' }]) {
    mocks.profile.mockResolvedValue({ data: profile });
    expect((await GET()).status).toBe(403);
  }
  expect(mocks.config).not.toHaveBeenCalled();
});
it('reports only the performed read and redacts backend diagnostics on failure', async () => {
  expect((await GET()).status).toBe(200);
  mocks.config.mockResolvedValue({ error: { message: 'sensitive-database-diagnostic' } });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('sensitive-database-diagnostic');
});
