import Link from 'next/link';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { SubmitButton } from '@/components/submit-button';
import { requireProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { dateTime } from '@/lib/operations/data';
import { markRead } from './actions';
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ error?:string }> }) {
  const profile=await requireProfile(); const client = await createClient(); const alerts = await searchParams;
  const { data, error } = await client.from('notifications').select('id,title,body,read_at,created_at,ride_request_id').order('created_at',{ascending:false}).limit(100);
  if(error) throw new Error('Notifications could not be loaded.');
  return <Dashboard eyebrow="Activity" title="Notifications" description="Booking updates and messages without an external push service.">{alerts.error && <p role="alert">{alerts.error}</p>}{data?.length ? data.map(notification => <DashboardCard key={notification.id} title={notification.title}><p>{notification.body}</p>{notification.ride_request_id && <Link href={profile.role==='passenger'?`/booking/${notification.ride_request_id}`:'/driver'}>Open related trip</Link>}<p className="muted">{dateTime(notification.created_at)} · {notification.read_at ? 'Read' : 'Unread'}</p>{!notification.read_at && <form action={markRead}><input name="id" type="hidden" value={notification.id} /><SubmitButton pendingLabel="Updating…">Mark read</SubmitButton></form>}</DashboardCard>) : <p className="large-empty">You’re up to date. New booking updates will appear here.</p>}</Dashboard>;
}
