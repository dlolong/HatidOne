import { Dashboard, DashboardCard } from '@/components/dashboard';
import { requireRole } from '@/lib/auth/session';

export default async function DriverDashboard() {
  await requireRole('driver');
  return (
    <Dashboard eyebrow="Driver workspace" title="Driver dashboard" description="Your driver-only workspace is protected and ready for onboarding in Sprint 2.">
      <DashboardCard title="Onboarding"><p className="empty-state">Driver onboarding has not been submitted.</p></DashboardCard>
      <DashboardCard title="Ride access"><p>Ride offers remain unavailable until verification and eligibility checks are implemented.</p></DashboardCard>
    </Dashboard>
  );
}
