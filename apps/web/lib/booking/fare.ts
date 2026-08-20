import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingVehicleType } from './booking';

export type FareInput = {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: BookingVehicleType;
};

export type FareQuote = {
  distanceMeters: number;
  durationSeconds: number;
  estimatedFare: number;
};

export interface FareCalculator {
  quote(input: FareInput): Promise<FareQuote>;
}

export function createPlaceholderFareCalculator(supabase: SupabaseClient): FareCalculator {
  return {
    async quote(input) {
      const { data, error } = await supabase.rpc('placeholder_scheduled_fare', {
        p_pickup_lat: input.pickupLat,
        p_pickup_lng: input.pickupLng,
        p_dropoff_lat: input.dropoffLat,
        p_dropoff_lng: input.dropoffLng,
        p_vehicle_type: input.vehicleType,
      });
      const quote = Array.isArray(data) ? data[0] : null;
      if (error || !quote) throw new Error('Fare quote unavailable');
      return {
        distanceMeters: Number(quote.distance_meters),
        durationSeconds: Number(quote.duration_seconds),
        estimatedFare: Number(quote.estimated_fare),
      };
    },
  };
}
