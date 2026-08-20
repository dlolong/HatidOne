import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { findEligibleDrivers } from './dispatch';

export type DriverOffer = {
  id: string;
  expiresAt: string;
  distanceMeters: number | null;
  ride: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
    scheduledAt: string | null;
    vehicleType: string;
    estimatedFare: number | string | null;
  };
};

export type DispatchRide = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string | null;
  vehicle_type: string;
  estimated_fare: number | string | null;
  status: string;
};

export type AssignedRide = {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  scheduledAt: string | null;
  status: string;
};

export async function getDriverDispatchData() {
  const profile = await requireRole('driver');
  const supabase = await createClient();
  const { data: driver } = await supabase
    .from('driver_profiles')
    .select('id, online, verification_status')
    .eq('user_id', profile.id)
    .maybeSingle();
  if (!driver) return { driver: null, offers: [] as DriverOffer[], assignedRide: null as AssignedRide | null };

  const { data: offerRows, error } = await supabase
    .from('ride_offers')
    .select('id, ride_request_id, expires_at, distance_meters')
    .eq('driver_id', driver.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });
  if (error) throw new Error('Ride offers could not be loaded');

  const offers = await Promise.all((offerRows ?? []).map(async (offer): Promise<DriverOffer | null> => {
    const { data: ride } = await supabase
      .from('ride_requests')
      .select('id, pickup_address, dropoff_address, scheduled_at, vehicle_type, estimated_fare')
      .eq('id', offer.ride_request_id)
      .maybeSingle();
    if (!ride) return null;
    return {
      id: String(offer.id),
      expiresAt: String(offer.expires_at),
      distanceMeters: offer.distance_meters === null ? null : Number(offer.distance_meters),
      ride: {
        id: String(ride.id),
        pickupAddress: String(ride.pickup_address),
        dropoffAddress: String(ride.dropoff_address),
        scheduledAt: ride.scheduled_at === null ? null : String(ride.scheduled_at),
        vehicleType: String(ride.vehicle_type),
        estimatedFare: ride.estimated_fare,
      },
    };
  }));
  const { data: assignment } = await supabase
    .from('ride_assignments')
    .select('ride_request_id')
    .eq('driver_id', driver.id)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let assignedRide: AssignedRide | null = null;
  if (assignment) {
    const { data: ride } = await supabase
      .from('ride_requests')
      .select('id, pickup_address, dropoff_address, scheduled_at, status')
      .eq('id', assignment.ride_request_id)
      .in('status', ['assigned', 'driver_en_route', 'driver_arrived', 'trip_started'])
      .maybeSingle();
    if (ride) {
      assignedRide = {
        id: String(ride.id),
        pickupAddress: String(ride.pickup_address),
        dropoffAddress: String(ride.dropoff_address),
        scheduledAt: ride.scheduled_at === null ? null : String(ride.scheduled_at),
        status: String(ride.status),
      };
    }
  }
  return { driver, offers: offers.filter((offer): offer is DriverOffer => offer !== null), assignedRide };
}

export async function getDispatchQueue(): Promise<DispatchRide[]> {
  await requireRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ride_requests')
    .select('id, pickup_address, dropoff_address, scheduled_at, vehicle_type, estimated_fare, status')
    .in('status', ['requested', 'searching', 'offered'])
    .order('scheduled_at', { ascending: true, nullsFirst: false });
  if (error) throw new Error('Dispatch queue could not be loaded');
  return (data ?? []) as DispatchRide[];
}

export async function getEligibleDriversForRide(rideId: string, radiusMeters: number) {
  await requireRole('admin');
  const supabase = await createClient();
  return findEligibleDrivers(supabase, rideId, radiusMeters);
}
