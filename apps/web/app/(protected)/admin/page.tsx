import Link from 'next/link';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { requireRole } from '@/lib/auth/session';

export default async function AdminDashboard() {
  await requireRole('admin');
  return (
    <Dashboard eyebrow="Operations workspace" title="Platform administration" description="This route requires a trusted administrator role stored in the database.">
      <DashboardCard title="Dispatch"><p>Find eligible nearby drivers, create timed offers, and assign rides manually.</p><Link className="button button-primary" href="/admin/dispatch">Open dispatch</Link></DashboardCard>
      <DashboardCard title="Security"><p>Public signup can never create an administrator or fleet administrator account.</p></DashboardCard>
    </Dashboard>
  );
}
