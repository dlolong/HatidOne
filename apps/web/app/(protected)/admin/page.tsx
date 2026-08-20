import { Dashboard, DashboardCard } from '@/components/dashboard';
import { requireRole } from '@/lib/auth/session';

export default async function AdminDashboard() {
  await requireRole('admin');
  return (
    <Dashboard eyebrow="Operations workspace" title="Platform administration" description="This route requires a trusted administrator role stored in the database.">
      <DashboardCard title="Reviews"><p className="empty-state">No pending review interface is implemented yet.</p></DashboardCard>
      <DashboardCard title="Security"><p>Public signup can never create an administrator or fleet administrator account.</p></DashboardCard>
    </Dashboard>
  );
}
