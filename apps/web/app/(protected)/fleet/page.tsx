import Link from 'next/link';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { requireRole } from '@/lib/auth/session';
import { getOrganizations } from '@/lib/operations/data';
export default async function FleetDashboard() {
  await requireRole('fleet_admin');
  const fleets = (await getOrganizations()).filter(org => org.kind === 'fleet');
  return <Dashboard eyebrow="Fleet operations" title="Your fleet, ready for the day" description="Manage transport schedules, authorized members, records and subscriptions.">{fleets.map(fleet => <DashboardCard title={fleet.name} key={fleet.id}><Link className="button button-primary" href={`/organizations/${fleet.id}`}>Open fleet workspace</Link></DashboardCard>)}<DashboardCard title="Fleet accounts"><p>{fleets.length ? 'Open your fleet to review bookings and your current subscription.' : 'Create a fleet business account to start coordinating transport.'}</p><Link href="/organizations">Manage business accounts</Link></DashboardCard></Dashboard>;
}
