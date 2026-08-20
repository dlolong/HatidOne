import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export type RideRequestSummary = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string | null;
  vehicle_type: string;
  estimated_distance_meters: number | null;
  estimated_duration_seconds: number | null;
  estimated_fare: number | string | null;
  passenger_notes: string | null;
  status: string;
  created_at: string;
};

export type RideRequestEvent = {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
};

const RIDE_FIELDS = 'id, pickup_address, dropoff_address, scheduled_at, vehicle_type, estimated_distance_meters, estimated_duration_seconds, estimated_fare, passenger_notes, status, created_at';

export async function getPassengerBookings(limit?: number): Promise<RideRequestSummary[]> {
  await requireRole('passenger');
  const supabase = await createClient();
  let query = supabase
    .from('ride_requests')
    .select(RIDE_FIELDS)
    .order('scheduled_at', { ascending: false, nullsFirst: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error('Bookings could not be loaded');
  return (data ?? []) as RideRequestSummary[];
}

export async function getPassengerBooking(id: string): Promise<{ booking: RideRequestSummary; events: RideRequestEvent[] } | null> {
  await requireRole('passenger');
  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from('ride_requests')
    .select(RIDE_FIELDS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('Booking could not be loaded');
  if (!booking) return null;

  const { data: events } = await supabase
    .from('ride_request_events')
    .select('id, event_type, from_status, to_status, created_at')
    .eq('ride_request_id', id)
    .order('created_at', { ascending: true });
  return {
    booking: booking as RideRequestSummary,
    events: (events ?? []) as RideRequestEvent[],
  };
}
