import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ profile: vi.fn(), rpc: vi.fn(), create: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT ${path}`); } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/auth/session', () => ({ requireProfile: mocks.profile }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.create }));
import { beginApplication } from './actions';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile.mockResolvedValue({ id: 'same-existing-user', role: 'passenger' });
  mocks.create.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ error: null });
});
it('starts using authenticated identity with no client-supplied role or applicant ID', async () => {
  await expect(beginApplication()).rejects.toThrow('REDIRECT /driver-application');
  expect(mocks.profile).toHaveBeenCalledOnce();
  expect(mocks.rpc).toHaveBeenCalledWith('request_driver_application');
});
it('application setup failure is actionable and can retry with the current account', async () => {
  mocks.rpc.mockResolvedValue({ error: { message: 'fictional private error' } });
  await expect(beginApplication()).rejects.toThrow('Application%20setup%20could%20not%20finish');
  mocks.rpc.mockResolvedValue({ error: null });
  await expect(beginApplication()).rejects.toThrow('REDIRECT /driver-application');
});
it('requires verified profile before application mutation', async () => {
  mocks.profile.mockRejectedValue(new Error('REDIRECT /login'));
  await expect(beginApplication()).rejects.toThrow('REDIRECT /login');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
