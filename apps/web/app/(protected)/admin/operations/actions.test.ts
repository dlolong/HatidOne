import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ role: vi.fn(), create: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT ${path}`); } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/auth/session', () => ({ requireRole: mocks.role }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.create }));
import { reviewDriver, resolveSafety, updateConfiguration } from './actions';
beforeEach(() => { vi.clearAllMocks(); mocks.role.mockResolvedValue({ role: 'admin' }); mocks.create.mockResolvedValue({ rpc: mocks.rpc }); mocks.rpc.mockResolvedValue({ error: null }); });
function form() { const value = new FormData(); value.set('driver_id', '11111111-1111-4111-8111-111111111111'); value.set('decision', 'verified'); return value; }
it('explains the active-booking approval gate without exposing provider diagnostics', async () => {
  mocks.rpc.mockResolvedValue({ error: { message: 'finish or cancel active passenger bookings before driver approval' } });
  await expect(reviewDriver(form())).rejects.toThrow('Approval%20is%20waiting');
  expect(mocks.role).toHaveBeenCalledWith('admin');
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it('requires admin and reports only a successful trusted review as saved', async () => {
  await expect(reviewDriver(form())).rejects.toThrow('Driver%20review%20saved');
  expect(mocks.rpc).toHaveBeenCalledWith('admin_review_driver', { p_driver_id: '11111111-1111-4111-8111-111111111111', p_decision: 'verified', p_reason: null });
  mocks.role.mockRejectedValue(new Error('REDIRECT /passenger'));
  mocks.rpc.mockClear();
  await expect(reviewDriver(form())).rejects.toThrow('REDIRECT /passenger');
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('preserves the review detail after saving and ignores arbitrary return paths', async () => {
  const value = form(); value.set('return_to', 'driver');
  await expect(reviewDriver(value)).rejects.toThrow('/admin/drivers/11111111-1111-4111-8111-111111111111?message=');
  value.set('return_to', 'https://example.invalid');
  await expect(reviewDriver(value)).rejects.toThrow('/admin/drivers?message=');
});
it('rejects malformed reviews before calling the mutation', async () => {
  for (const [key, value] of [['driver_id','bad'], ['decision','admin'], ['decision','rejected']]) {
    const input = form(); input.set(key, value);
    await expect(reviewDriver(input)).rejects.toThrow('?error=');
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('rejects incomplete configuration rather than zeroing omitted settings', async () => {
  await expect(updateConfiguration(new FormData())).rejects.toThrow('#system');
  expect(mocks.role).toHaveBeenCalledWith('admin');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('keeps operations actions in their section on success and transport failure', async () => {
  await expect(resolveSafety(new FormData())).rejects.toThrow('Changes%20saved.#safety');
  mocks.rpc.mockRejectedValue(new Error('private diagnostic'));
  await expect(resolveSafety(new FormData())).rejects.toThrow('field%20values.#safety');
});
