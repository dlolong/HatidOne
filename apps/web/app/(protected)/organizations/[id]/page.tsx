import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { WorkspaceTabs } from '@/components/workspace-tabs';
import { BusinessRideList } from '@/components/business-ride-list';
import { StatusPill } from '@/components/ui';
import { PartnerReferrals } from '@/components/partner-referrals';
import { FleetResources } from '@/components/fleet-resources';
import { CopyLink } from '@/components/copy-link';
import { TransportForm } from '@/components/transport-form';
import { SubmitButton } from '@/components/submit-button';
import { getOrganization, dateTime, money } from '@/lib/operations/data';
import { saveLocation, saveMember } from '../actions';
export default async function OrganizationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string; status?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [result, alerts] = await Promise.all([getOrganization(id), searchParams]);
  if (!result) notFound();
  const { organization: org, rides, canManage, members, locations, subscription, plans } = result;
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(new Date());
  const monthly = rides.filter(ride => ride.scheduled_at && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(new Date(ride.scheduled_at)) === month);
  const upcoming = rides.filter(ride => ['requested','searching','offered','assigned','driver_en_route','driver_arrived','trip_started'].includes(ride.status));
  const plan = plans.find(item => item.id === subscription?.plan_id);
  return <Dashboard eyebrow={`${org.kind} mobility`} title={org.name} description="Coordinate scheduled transport, authorized riders and business records.">
    <Link className="back-link dashboard-wide" href="/organizations">← Business accounts</Link>
    {alerts.error && <p className="notice notice-error dashboard-wide" role="alert">{alerts.error}</p>}{alerts.message && <p className="notice notice-success dashboard-wide" role="status">{alerts.message}</p>}
    <WorkspaceTabs label="Business workspace" sections={[
{ id: 'schedule', label: 'Schedule', content: <><DashboardCard title={org.kind === 'corporate' ? 'Upcoming employee rides' : org.kind === 'partner' ? 'Guest transportation' : 'Fleet schedule'}><p className="stat-value">{upcoming.length}</p><p>{upcoming.filter(ride => ['requested','searching','offered'].includes(ride.status)).length} awaiting a driver · {upcoming.filter(ride => ['driver_en_route','driver_arrived','trip_started'].includes(ride.status)).length} active trips</p></DashboardCard><DashboardCard title="Billing status">{subscription ? <><StatusPill status={subscription.billing_status} /><p>{plan?.display_name ?? subscription.plan_id}</p></> : <p>No plan activated yet.</p>}<a className="button button-secondary" href="#subscription">View plan and usage</a></DashboardCard><BusinessRideList initialStatus={alerts.status} rides={rides.map(ride => ({ id: ride.id, pickup_address: ride.pickup_address, dropoff_address: ride.dropoff_address, scheduled_at: ride.scheduled_at, status: ride.status, passenger_count: ride.passenger_count, estimated_fare: ride.estimated_fare, reference: ride.external_reference || ride.ride_purpose || '', href: ride.passenger_id === result.profile.id && result.profile.role === 'passenger' ? `/booking/${ride.id}` : undefined }))} />    {org.kind === 'partner' && <DashboardCard title="Guest booking link"><CopyLink path={`/book?partner_id=${org.id}`} /></DashboardCard>}
    {org.kind === 'partner' && canManage && <PartnerReferrals id={id} />}
</> },
{ id: 'request', label: 'Request ride', content: <>    <section className="dashboard-card dashboard-wide" id="request"><h2>Request {org.kind === 'corporate' ? 'employee' : 'guest'} transport</h2>{canManage ? <TransportForm organizationId={id} corporate={org.kind === 'corporate'} /> : <p>Ask a business account manager to arrange your transport. Your personal rides remain available in the passenger booking flow.</p>}</section>
</> },
...(org.kind === 'fleet' && canManage ? [{ id: 'fleet', label: 'Drivers & vehicles', content: <FleetResources organizationId={id} admin={result.profile.role === 'admin'} /> }] : []),
{ id: 'members', label: 'People & places', content: <>    <section className="dashboard-card" id="members"><h2>Authorized members</h2>{members.length ? <ul className="record-list">{members.map(member => <li key={member.id}><span className="wrap-anywhere">{member.user_id}</span><br />{member.member_role} · {member.status}</li>)}</ul> : <p>No visible members.</p>}{canManage && <details><summary>Add or update member</summary><form action={saveMember} className="compact-form"><input type="hidden" name="organization_id" value={id} /><label>Registered member email<input name="email" type="email" required placeholder="employee@example.test" /></label><label>Access<select name="member_role"><option value="rider">Rider</option><option value="manager">Manager</option></select></label><label>Status<select name="status"><option value="active">Active</option><option value="inactive">Inactive</option></select></label><SubmitButton pendingLabel="Saving…">Save member</SubmitButton></form></details>}</section>
    <section className="dashboard-card" id="locations"><h2>Pickup locations</h2>{locations.length ? <ul>{locations.map(location => <li key={location.id}><strong>{location.label}</strong><p>{location.address}</p></li>)}</ul> : <p>No saved locations.</p>}{canManage && <details><summary>Add location</summary><form action={saveLocation} className="compact-form"><input type="hidden" name="organization_id" value={id} /><label>Label<input name="label" required maxLength={100} placeholder="Guest lobby" /></label><label>Address<input name="address" required maxLength={240} /></label><div className="form-grid"><label>Latitude<input name="latitude" required type="number" step="any" min={-90} max={90} /></label><label>Longitude<input name="longitude" required type="number" step="any" min={-180} max={180} /></label></div><SubmitButton pendingLabel="Saving…">Save location</SubmitButton></form></details>}</section>
</> },
{ id: 'subscription', label: 'Plan & usage', content: <>    <DashboardCard title="This month"><p>{monthly.length} rides · {monthly.filter(ride => ride.status === 'trip_completed').length} completed</p><p>{money(monthly.reduce((total, ride) => total + (ride.status === 'trip_completed' ? Number(ride.estimated_fare ?? 0) : 0), 0))} completed ride estimates</p><p className="muted">Planning summary from the latest 200 bookings. Final settlement is recorded manually.</p></DashboardCard>
    <section className="dashboard-card dashboard-wide" id="subscription"><h2>Subscription</h2>{subscription ? <><p>{plan?.display_name ?? subscription.plan_id} · <StatusPill status={result.subscriptionExpired ? 'expired' : subscription.status} /></p><p>Renewal / expiration: {dateTime(subscription.expires_at)} · Billing: {subscription.billing_status.replaceAll('_', ' ')}</p><ul>{(plan?.features ?? []).map(feature => <li key={feature}>{feature}</li>)}</ul></> : <p>No subscription activated yet. Operations can activate a plan manually.</p>}<p className="muted">No recurring card charge is enabled. Contact operations for plan changes and billing.</p></section>
</> }
]} />
  </Dashboard>;
}
