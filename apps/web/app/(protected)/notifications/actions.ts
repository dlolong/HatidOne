'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
export async function markRead(form: FormData) {
  await requireProfile(); const client = await createClient();
  const id = form.get('id');
  if (typeof id !== 'string') return;
  const { error } = await client.rpc('mark_notification_read',{p_notification_id:id});
  if(error) redirect('/notifications?error=Notification%20could%20not%20be%20updated.');
  revalidatePath('/notifications');
}
