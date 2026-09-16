import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ role: vi.fn(), rpc: vi.fn(), offers: vi.fn(), expire: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/auth/session', () => ({ requireRole: mocks.role }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/dispatch/dispatch', () => ({ createRideOffers: mocks.offers, expireRideOffers: mocks.expire }));
import { createOffers, expireOffers, manualAssign } from './actions';
const rideId = '11111111-1111-4111-8111-111111111111';
function assignment() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ rideId, driverId: rideId, vehicleId: rideId, quoteVersion: '2', reason: 'Reviewed passenger pickup and scheduling interval' })) form.set(key, value);
  return form;
}
beforeEach(() => { vi.clearAllMocks(); mocks.role.mockResolvedValue({ role: 'admin' }); mocks.rpc.mockResolvedValue({ error: null, data: rideId }); mocks.offers.mockResolvedValue(1); mocks.expire.mockResolvedValue(2); });
describe('dispatch server action outcomes', () => {
  it('does not swallow successful offer/expiry redirects as errors', async () => {
    await expect(createOffers(assignment())).rejects.toThrow(`REDIRECT /admin/dispatch?ride=${rideId}&radius=25000&message=1%20active%20driver%20offer.`);
    await expect(expireOffers()).rejects.toThrow('REDIRECT /admin/dispatch?message=2%20expired%20offers%20processed.');
  });
  it('sends version and review reason to the authorized assignment RPC and preserves success redirect', async () => {
    await expect(manualAssign(assignment())).rejects.toThrow('REDIRECT /admin/dispatch?message=Driver%20assigned.');
    expect(mocks.role).toHaveBeenCalledWith('admin');
    expect(mocks.rpc).toHaveBeenCalledWith('rc1_manual_assign_ride', expect.objectContaining({ p_expected_version: 2, p_reason: 'Reviewed passenger pickup and scheduling interval' }));
  });
  it('reports rejected eligibility without a success redirect', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'stale' } });
    await expect(manualAssign(assignment())).rejects.toThrow('error=Assignment%20could%20not%20be%20completed.');
  });
  it('does not mutate when admin authorization fails', async () => {
    mocks.role.mockRejectedValue(new Error('not admin'));
    await expect(manualAssign(assignment())).rejects.toThrow('not admin');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

it('rejects missing quote versions, malformed IDs and short reasons before assignment', async () => {
  for (const [key, value] of [['quoteVersion',''], ['quoteVersion','-1'], ['driverId','------------------------------------'], ['reason','bad']]) {
    const input = assignment(); input.set(key, value);
    await expect(manualAssign(input)).rejects.toThrow('error=');
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('preserves the selected ride and radius when offer creation fails', async () => {
  mocks.offers.mockRejectedValue(new Error('provider details'));
  const input = assignment(); input.set('radiusMeters','10000');
  await expect(createOffers(input)).rejects.toThrow(`ride=${rideId}&radius=10000&error=Offers`);
});
