'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/admin/validation';
import { createRideOffers, expireRideOffers } from '@/lib/dispatch/dispatch';

function idValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return isUuid(value) ? value : null;
}

function radiusValue(formData: FormData): number {
  const radius = Number(formData.get('radiusMeters'));
  return Number.isInteger(radius) && radius >= 1000 && radius <= 100000 ? radius : 25000;
}

export async function createOffers(formData: FormData) {
  await requireRole('admin');
  const rideId = idValue(formData, 'rideId');
  if (!rideId) redirect('/admin/dispatch?error=Invalid%20ride.');
  const destination = `/admin/dispatch?ride=${rideId}&radius=${radiusValue(formData)}`;
  const supabase = await createClient();
  let count: number;
  try {
    count = await createRideOffers(supabase, rideId, radiusValue(formData));
  } catch {
    redirect(`${destination}&error=Offers%20could%20not%20be%20created.%20Check%20quote%20acceptance%20and%20driver%20eligibility.`);
  }
  revalidatePath('/admin/dispatch');
  redirect(`${destination}&message=${encodeURIComponent(count ? `${count} active driver offer${count === 1 ? '' : 's'}.` : 'No active driver offers. Review quote acceptance and current driver eligibility.')}`);
}

export async function expireOffers() {
  await requireRole('admin');
  const supabase = await createClient();
  let count: number;
  try {
    count = await expireRideOffers(supabase);
  } catch {
    redirect('/admin/dispatch?error=Expired%20offers%20could%20not%20be%20processed.');
  }
  revalidatePath('/admin/dispatch');
  redirect(`/admin/dispatch?message=${encodeURIComponent(`${count} expired offers processed.`)}`);
}

export async function manualAssign(formData: FormData) {
  await requireRole('admin');
  const rideId = idValue(formData, 'rideId');
  const driverId = idValue(formData, 'driverId');
  const vehicleId = idValue(formData, 'vehicleId');
  if (!rideId || !driverId || !vehicleId) redirect('/admin/dispatch?error=Invalid%20assignment.');
  const destination = `/admin/dispatch?ride=${rideId}&radius=${radiusValue(formData)}`;
  const reason = formData.get('reason');
  const version = formData.get('quoteVersion');
  const expectedVersion = typeof version === 'string' && version.trim() ? Number(version) : NaN;
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 2000 || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    redirect(`${destination}&error=Provide%20a%20review%20reason%20and%20reload%20the%20current%20quote%20before%20assigning.`);
  }
  const supabase = await createClient();
  let failed = false;
  try {
    const { error } = await supabase.rpc('rc1_manual_assign_ride', { p_ride_request_id: rideId, p_driver_id: driverId, p_vehicle_id: vehicleId, p_expected_version: expectedVersion, p_reason: reason.trim() });
    failed = !!error;
  } catch { failed = true; }
  if (failed) redirect(`${destination}&error=Assignment%20could%20not%20be%20completed.%20Reload%20to%20check%20the%20quote,%20ride%20status%20and%20driver%20eligibility.`);
  revalidatePath('/admin/dispatch');
  revalidatePath('/admin');
  revalidatePath('/admin/operations');
  redirect('/admin/dispatch?message=Driver%20assigned.%20Awaiting%20driver%20reconfirmation.');
}
