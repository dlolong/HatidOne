'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  isBookingVehicleType,
  parseCoordinate,
  parsePhilippineSchedule,
} from '@/lib/booking/booking';
import { createPlaceholderFareCalculator } from '@/lib/booking/fare';

function textValue(formData: FormData, key: string, maximumLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maximumLength ? trimmed : null;
}

function fail(message: string): never {
  redirect(`/book?error=${encodeURIComponent(message)}`);
}

export async function createBooking(formData: FormData) {
  await requireRole('passenger');
  const requestId = textValue(formData, 'requestId', 40);
  const pickupAddress = textValue(formData, 'pickupAddress', 240);
  const dropoffAddress = textValue(formData, 'dropoffAddress', 240);
  const pickupLat = parseCoordinate(formData.get('pickupLat'), -90, 90);
  const pickupLng = parseCoordinate(formData.get('pickupLng'), -180, 180);
  const dropoffLat = parseCoordinate(formData.get('dropoffLat'), -90, 90);
  const dropoffLng = parseCoordinate(formData.get('dropoffLng'), -180, 180);
  const scheduledAt = parsePhilippineSchedule(formData.get('scheduledAt'));
  const vehicleType = formData.get('vehicleType');
  const notesValue = formData.get('passengerNotes');
  const passengerNotes = typeof notesValue === 'string' ? notesValue.trim() : '';

  if (!requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    fail('The booking form expired. Refresh and try again.');
  }
  if (!pickupAddress || !dropoffAddress || !scheduledAt || !isBookingVehicleType(vehicleType)) {
    fail('Review the addresses, schedule, and vehicle type.');
  }
  if (scheduledAt.getTime() < Date.now() + 30 * 60 * 1000) fail('Schedule the pickup at least 30 minutes from now.');
  if (scheduledAt.getTime() > Date.now() + 180 * 24 * 60 * 60 * 1000) fail('Bookings can be scheduled up to 180 days ahead.');
  if (passengerNotes.length > 500) fail('Passenger notes must be 500 characters or fewer.');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_transport_request', {
    p_payload: {
      client_request_id: requestId, pickup_address: pickupAddress, pickup_lat: pickupLat, pickup_lng: pickupLng,
      dropoff_address: dropoffAddress, dropoff_lat: dropoffLat, dropoff_lng: dropoffLng,
      scheduled_at: scheduledAt.toISOString(), vehicle_type: vehicleType, passenger_notes: passengerNotes || null,
      passenger_count: Number(formData.get('passengerCount') || 1), service_type: textValue(formData, 'serviceType', 20) || 'scheduled',
      route_preference: textValue(formData, 'routePreference', 30) || 'fastest',
      partner_id: textValue(formData, 'partnerId', 36), external_reference: textValue(formData, 'externalReference', 120),
    },
  });
  if (error || typeof data !== 'string') fail('Your booking could not be created. Please try again.');
  revalidatePath('/passenger');
  revalidatePath('/history');
  redirect(`/booking/${data}?message=${encodeURIComponent('Ride requested successfully.')}`);
}

export async function cancelBooking(formData: FormData) {
  await requireRole('passenger');
  const bookingId = textValue(formData, 'bookingId', 40);
  if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) redirect('/history?error=Invalid%20booking.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_own_ride_request', { p_ride_request_id: bookingId });
  if (error) redirect(`/booking/${bookingId}?error=${encodeURIComponent('This booking can no longer be cancelled.')}`);
  revalidatePath('/passenger');
  revalidatePath('/history');
  revalidatePath(`/booking/${bookingId}`);
  redirect(`/booking/${bookingId}?message=${encodeURIComponent('Booking cancelled.')}`);
}

export async function quoteBooking(input: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number; vehicleType: string }) {
  await requireRole('passenger');
  if (!isBookingVehicleType(input.vehicleType) || !Number.isFinite(input.pickupLat) || Math.abs(input.pickupLat)>90 || !Number.isFinite(input.dropoffLat) || Math.abs(input.dropoffLat)>90 || !Number.isFinite(input.pickupLng) || Math.abs(input.pickupLng)>180 || !Number.isFinite(input.dropoffLng) || Math.abs(input.dropoffLng)>180) return { error: 'Choose locations with valid coordinates.', quote: null };
  try { const client = await createClient(); const quote = await createPlaceholderFareCalculator(client).quote({...input,vehicleType:input.vehicleType}); return { quote, error: null }; }
  catch { return { quote:null,error:'Fare estimate unavailable. Check the locations and try again.' }; }
}
