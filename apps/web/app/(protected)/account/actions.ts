'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
export async function requestAccountDeletion(form: FormData) {
  await requireProfile();
  const reason = form.get('reason');
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 2000) redirect('/account?error=Please%20provide%20a%20short%20request%20reason.');
  const client = await createClient();
  const { error } = await client.rpc('request_account_deletion', { p_reason: reason.trim() });
  revalidatePath('/account');
  if (error) redirect('/account?error=Request%20could%20not%20be%20recorded.%20Please%20retry.');
  redirect('/account?message=Deletion%20request%20recorded.%20Your%20account%20has%20not%20been%20deleted.');
}
