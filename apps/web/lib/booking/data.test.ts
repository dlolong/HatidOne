import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ profile: vi.fn(), create: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requireProfile: mocks.profile }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.create }));
import { getPassengerBooking, getPassengerBookings } from './data';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile.mockResolvedValue({ id: 'same-approved-account', role: 'driver' });
  const chain = { select: mocks.select, eq: mocks.eq, order: mocks.order, maybeSingle: mocks.maybeSingle };
  mocks.create.mockResolvedValue({ from: mocks.from });
  mocks.from.mockReturnValue(chain); mocks.select.mockReturnValue(chain); mocks.eq.mockReturnValue(chain);
  mocks.order.mockResolvedValue({ data: [], error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
});
it('keeps historical passenger reads after driver approval and explicitly limits to own passenger rows', async () => {
  await expect(getPassengerBookings()).resolves.toEqual([]);
  expect(mocks.eq).toHaveBeenCalledWith('passenger_id', 'same-approved-account');
});
it('cannot treat another passenger’s booking as own history, even when driver assignment RLS permits reading it', async () => {
  await expect(getPassengerBooking('someone-elses-trip')).resolves.toBeNull();
  expect(mocks.eq).toHaveBeenCalledWith('passenger_id', 'same-approved-account');
  expect(mocks.eq).toHaveBeenCalledWith('id', 'someone-elses-trip');
});
