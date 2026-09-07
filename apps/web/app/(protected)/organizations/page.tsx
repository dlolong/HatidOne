import Link from 'next/link';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { SubmitButton } from '@/components/submit-button';
import { getOrganizations } from '@/lib/operations/data';
import { createOrganization } from './actions';
export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [organizations, alerts] = await Promise.all([getOrganizations(), searchParams]);
  return <Dashboard eyebrow="Business mobility" title="Your business accounts" description="Guest transfers, employee travel and fleet transportation in one place.">
    {alerts.error && <p className="notice notice-error dashboard-wide" role="alert">{alerts.error}</p>}
    <div className="dashboard-wide business-cards">{organizations.length ? organizations.map(org => <DashboardCard key={org.id} title={org.name}><p>{org.partner_type ?? org.kind}</p><Link className="button button-primary" href={`/organizations/${org.id}`}>Open account</Link></DashboardCard>) : <p className="large-empty compact-empty">No business accounts yet. Create one to coordinate transportation.</p>}</div>
    <DashboardCard title="Create business account"><form action={createOrganization} className="compact-form"><label>Business name<input name="name" required maxLength={160} /></label><label>Account type<select name="kind"><option value="partner">Resort / hotel / partner</option><option value="corporate">Corporate</option><option value="fleet">Fleet</option></select></label><label>Partner type<select name="partner_type"><option value="resort">Resort</option><option value="hotel">Hotel</option><option value="travel_agent">Travel agent</option><option value="transport_operator">Transport operator</option><option value="corporate">Corporate</option><option value="other">Other</option></select></label><SubmitButton pendingLabel="Creating…">Create account</SubmitButton></form></DashboardCard>
    <DashboardCard title="Simple business subscriptions"><p>Free, Starter, Business and Enterprise plans support the transport network. An administrator activates plans and records billing manually.</p><p>Driver platform commission defaults to 0%. Your plan and renewal appear inside your account.</p></DashboardCard>
  </Dashboard>;
}
