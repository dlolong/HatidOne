import { Dashboard, DashboardCard } from '@/components/dashboard';
import { requireRole } from '@/lib/auth/session';

export default async function FleetDashboard() {
  await requireRole('fleet_admin');
  return (
    <Dashboard eyebrow="Fleet workspace" title="Fleet administration" description="A protected home for managing fleet operations in later sprints.">
      <DashboardCard title="Drivers"><p className="empty-state">No fleet driver tools are available yet.</p></DashboardCard>
      <DashboardCard title="Vehicles"><p className="empty-state">No fleet vehicle tools are available yet.</p></DashboardCard>
    </Dashboard>
  );
}
