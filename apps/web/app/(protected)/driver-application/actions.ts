'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
export async function beginApplication() {
  await requireProfile();
  const client = await createClient();
  let failed = false;
  try { const { error } = await client.rpc('request_driver_application'); failed = !!error; }
  catch { failed = true; }
  if (failed) redirect('/driver-application?error=Application%20setup%20could%20not%20finish.%20Your%20account%20is%20unchanged.%20Retry%20below.%20If%20this%20continues%2C%20contact%20your%20operator.');
  revalidatePath('/driver-application');
  redirect('/driver-application');
}
