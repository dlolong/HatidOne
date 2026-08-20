'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { acceptRideOffer } from '@/lib/dispatch/dispatch';

function coordinate(formData: FormData, key: string, minimum: number, maximum: number): number | null {
  const value = formData.get(key);
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export async function updateDriverAvailability(formData: FormData) {
  await requireRole('driver');
  const online = formData.get('online') === 'true';
  const latitude = coordinate(formData, 'latitude', -90, 90);
  const longitude = coordinate(formData, 'longitude', -180, 180);
  if (online && (latitude === null || longitude === null)) {
    redirect('/driver?error=Enter%20a%20valid%20current%20location.');
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_driver_availability', {
    p_online: online,
    p_latitude: latitude,
    p_longitude: longitude,
  });
  if (error) redirect('/driver?error=Only%20verified%20drivers%20can%20go%20online.');
  revalidatePath('/driver');
  redirect(`/driver?message=${online ? 'You%20are%20online%20for%20ride%20offers.' : 'You%20are%20offline.'}`);
}

export async function acceptOffer(formData: FormData) {
  await requireRole('driver');
  const offerId = formData.get('offerId');
  if (typeof offerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(offerId)) {
    redirect('/driver?error=Invalid%20ride%20offer.');
  }
  const supabase = await createClient();
  try {
    await acceptRideOffer(supabase, offerId);
  } catch {
    redirect('/driver?error=This%20offer%20expired%20or%20another%20driver%20accepted%20it.');
  }
  revalidatePath('/driver');
  redirect('/driver?message=Ride%20accepted%20and%20assigned%20to%20you.');
}
