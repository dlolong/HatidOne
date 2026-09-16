import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDriverApplication } from '@/lib/driver/data';
import { SubmitButton } from '@/components/submit-button';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { logout } from '@/app/auth/actions';
import { beginApplication } from './actions';
export default async function DriverApplication({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [application, query] = await Promise.all([getDriverApplication(), searchParams]);
  const { profile, driver, error } = application;
  const canApply = ['passenger', 'driver'].includes(profile.role);
  if (!error && driver && canApply) {
    if (driver.verification_status === 'verified' && profile.role === 'driver') redirect('/driver');
    redirect('/driver/onboarding');
  }
  return <Dashboard eyebrow="Driver application" title="Apply to drive with your current account" description="Create your application, complete your details and documents, then submit for review.">
    {(query.error || error) && <p className="notice notice-error" role="alert">{query.error || error}</p>}
    <DashboardCard title="One HatidOne account">
      <p className="application-identity">Signed in as <strong>{profile.first_name} {profile.last_name}</strong>{profile.email ? <> · {profile.email}</> : null}.</p>
      <p>{canApply ? 'Use your existing HatidOne account—no new signup needed. Your passenger history stays with this account.' : 'Driver applications are unavailable for this operations or business account. Use the normal sign-out action to switch to your individual HatidOne account; this page cannot change your privileges.'}</p>
      <p>Starting an application does not approve you to drive or make you available for trips.</p>
      {!canApply ? null : error ? <Link className="button button-secondary" href="/driver-application">Retry loading application</Link> : <form action={beginApplication}><SubmitButton pendingLabel="Starting application…">Start application</SubmitButton></form>}
      <div className="button-row"><Link className="button button-secondary" href="/account">Back to account</Link><form action={logout}><input type="hidden" name="intent" value="driver" /><button className="button button-ghost" type="submit">Sign out to use another account</button></form></div>
    </DashboardCard>
  </Dashboard>;
}
