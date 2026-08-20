import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EligibleDriver = {
  driverId: string;
  vehicleId: string;
  driverUserId: string;
  distanceMeters: number;
};

export async function findEligibleDrivers(
  supabase: SupabaseClient,
  rideRequestId: string,
  radiusMeters = 25_000,
  limit = 20,
): Promise<EligibleDriver[]> {
  const { data, error } = await supabase.rpc('find_eligible_drivers', {
    p_ride_request_id: rideRequestId,
    p_radius_meters: radiusMeters,
    p_limit: limit,
  });
  if (error) throw new Error('Eligible drivers could not be loaded');
  return (Array.isArray(data) ? data : []).map((row) => ({
    driverId: String(row.driver_id),
    vehicleId: String(row.vehicle_id),
    driverUserId: String(row.driver_user_id),
    distanceMeters: Number(row.distance_meters),
  }));
}

export async function createRideOffers(
  supabase: SupabaseClient,
  rideRequestId: string,
  radiusMeters = 25_000,
): Promise<number> {
  const { data, error } = await supabase.rpc('create_ride_offers', {
    p_ride_request_id: rideRequestId,
    p_radius_meters: radiusMeters,
    p_offer_seconds: 120,
    p_limit: 20,
  });
  if (error) throw new Error('Ride offers could not be created');
  return Number(data);
}

export async function expireRideOffers(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc('expire_ride_offers');
  if (error) throw new Error('Ride offers could not be expired');
  return Number(data);
}

export async function acceptRideOffer(supabase: SupabaseClient, offerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_ride_offer', { p_offer_id: offerId });
  if (error || typeof data !== 'string') throw new Error('Ride offer could not be accepted');
  return data;
}

export async function manualAssignRide(
  supabase: SupabaseClient,
  rideRequestId: string,
  driverId: string,
  vehicleId: string,
  radiusMeters = 100_000,
): Promise<string> {
  const { data, error } = await supabase.rpc('manual_assign_ride', {
    p_ride_request_id: rideRequestId,
    p_driver_id: driverId,
    p_vehicle_id: vehicleId,
    p_radius_meters: radiusMeters,
  });
  if (error || typeof data !== 'string') throw new Error('Ride could not be assigned');
  return data;
}
