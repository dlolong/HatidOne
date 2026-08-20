import { Dashboard, DashboardCard } from '@/components/dashboard';
import { requireRole } from '@/lib/auth/session';

export default async function PassengerDashboard() {
  await requireRole('passenger');
  return (
    <Dashboard eyebrow="Passenger workspace" title="Ready when you are" description="Your secure passenger account is active. Booking arrives in Sprint 3.">
      <DashboardCard title="Upcoming rides"><p className="empty-state">You have no scheduled rides yet.</p></DashboardCard>
      <DashboardCard title="Account status"><p><span className="status-dot" /> Passenger profile ready</p><p className="muted">Only you can view this account dashboard.</p></DashboardCard>
    </Dashboard>
  );
}
