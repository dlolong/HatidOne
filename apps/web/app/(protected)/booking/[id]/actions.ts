'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export async function acceptReviewedQuote(form: FormData) {
  await requireRole('passenger');
  const id = form.get('ride_id');
  const version = Number(form.get('quote_version'));
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(version) || version < 1) redirect('/history?error=Invalid%20quote.');
  const client = await createClient();
  const { error } = await client.rpc('accept_ride_quote', { p_ride_request_id: id, p_version: version });
  revalidatePath(`/booking/${id}`);
  if (error) redirect(`/booking/${id}?error=Quote%20changed%20or%20could%20not%20be%20accepted.%20Refresh%20and%20review.`);
  redirect(`/booking/${id}?message=Quote%20accepted.%20Driver%20assignment%20and%20reconfirmation%20are%20still%20required.`);
}
