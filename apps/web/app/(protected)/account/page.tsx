import Link from 'next/link';
import { getDriverApplication } from '@/lib/driver/data';
import { createClient } from '@/lib/supabase/server';
import { dateTime } from '@/lib/operations/data';
import { SubmitButton } from '@/components/submit-button';
import { requestAccountDeletion } from './actions';
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { profile, driver, error: applicationError } = await getDriverApplication();
  const alerts = await searchParams;
  const client = await createClient();
  const { data, error } = await client.from('account_deletion_requests').select('id,status,created_at').eq('user_id', profile.id).order('created_at', { ascending: false });
  if (error) throw new Error('Account requests could not be loaded. Please retry.');
  return <section className="detail-card"><h1>{profile.role === 'admin' ? 'Administrator account' : 'Your account'}</h1>
    <p className="application-identity">{profile.first_name} {profile.last_name}{profile.email ? ` · ${profile.email}` : ''}</p>
    {['passenger', 'driver'].includes(profile.role) && <section className="dashboard-card">
      <h2>Driver application</h2>
      {applicationError ? <p className="notice notice-error" role="alert">Application status could not be loaded. Open the application to retry.</p> : <p>{!driver ? 'Use your existing HatidOne account—no new signup needed. Your passenger history stays with you.' : driver.verification_status === 'under_review' ? 'Application submitted. You cannot accept trips until your application is approved.' : driver.verification_status === 'verified' ? 'Application approved. Driver operations remain subject to current eligibility.' : driver.verification_status === 'rejected' ? 'Changes requested. Review the document reasons and update the items that need attention.' : driver.verification_status === 'suspended' ? 'Driver access is restricted. View your status; a new application cannot bypass this restriction.' : 'Your saved application is in progress. Continue where you left off.'}</p>}
      <Link className="button button-primary" href="/driver-application">{!driver ? 'Apply to drive' : driver.verification_status === 'verified' && profile.role === 'driver' ? 'Open driver dashboard' : ['under_review', 'suspended'].includes(driver.verification_status) ? 'View application' : 'Continue application'}</Link>
    </section>}
    {alerts.error && <p className="notice notice-error" role="alert">{alerts.error}</p>}{alerts.message && <p className="notice notice-success" role="status">{alerts.message}</p>}
    {['passenger', 'driver'].includes(profile.role) && <p><Link href="/history">View your passenger ride history</Link></p>}
    {profile.role === 'admin' && <section className="dashboard-card"><h2>Administrator access</h2><p>This account can review drivers, dispatch rides and manage operations. Administrative changes are checked on the server and recorded in the audit history.</p><dl className="admin-facts"><div><dt>Role</dt><dd>Administrator</dd></div><div><dt>Account status</dt><dd>Active</dd></div></dl><div className="button-row"><Link className="button button-primary" href="/admin">Open admin overview</Link><Link className="button button-secondary" href="/admin/operations#system">View system & audit history</Link><Link className="button button-secondary" href="/forgot-password">Reset password</Link></div></section>}
    <h2>Request account deletion</h2><p>This records a request for the operator. It does not delete your account or trip and collection records. Retention policy and the reviewed deletion process must be approved before requests can be completed.</p>
    {data?.length ? data.map(request => <p key={request.id}>{request.status.replaceAll('_',' ')} · {dateTime(request.created_at)}</p>) : <p>No deletion request recorded.</p>}
    <form action={requestAccountDeletion} className="compact-form"><label>Request details<textarea name="reason" minLength={3} maxLength={2000} required/></label><SubmitButton pendingLabel="Recording request…">Record deletion request</SubmitButton></form>
  </section>;
}
