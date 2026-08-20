'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createRideOffers, expireRideOffers, manualAssignRide } from '@/lib/dispatch/dispatch';

function idValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function radiusValue(formData: FormData): number {
  const radius = Number(formData.get('radiusMeters'));
  return Number.isInteger(radius) && radius >= 1000 && radius <= 100000 ? radius : 25000;
}

export async function createOffers(formData: FormData) {
  await requireRole('admin');
  const rideId = idValue(formData, 'rideId');
  if (!rideId) redirect('/admin/dispatch?error=Invalid%20ride.');
  const supabase = await createClient();
  try {
    const count = await createRideOffers(supabase, rideId, radiusValue(formData));
    revalidatePath('/admin/dispatch');
    redirect(`/admin/dispatch?message=${encodeURIComponent(`${count} ride offer${count === 1 ? '' : 's'} created.`)}`);
  } catch {
    redirect('/admin/dispatch?error=Offers%20could%20not%20be%20created.');
  }
}

export async function expireOffers() {
  await requireRole('admin');
  const supabase = await createClient();
  try {
    const count = await expireRideOffers(supabase);
    revalidatePath('/admin/dispatch');
    redirect(`/admin/dispatch?message=${encodeURIComponent(`${count} expired offer${count === 1 ? '' : 's'} processed.`)}`);
  } catch {
    redirect('/admin/dispatch?error=Expired%20offers%20could%20not%20be%20processed.');
  }
}

export async function manualAssign(formData: FormData) {
  await requireRole('admin');
  const rideId = idValue(formData, 'rideId');
  const driverId = idValue(formData, 'driverId');
  const vehicleId = idValue(formData, 'vehicleId');
  if (!rideId || !driverId || !vehicleId) redirect('/admin/dispatch?error=Invalid%20assignment.');
  const supabase = await createClient();
  try {
    await manualAssignRide(supabase, rideId, driverId, vehicleId, radiusValue(formData));
    revalidatePath('/admin/dispatch');
    redirect('/admin/dispatch?message=Ride%20assigned%20successfully.');
  } catch {
    redirect(`/admin/dispatch?ride=${rideId}&error=The%20driver%20is%20no%20longer%20eligible.`);
  }
}
