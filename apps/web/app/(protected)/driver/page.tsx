import Link from 'next/link';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { requireRole } from '@/lib/auth/session';

export default async function DriverDashboard() {
  await requireRole('driver');
  return (
    <Dashboard eyebrow="Driver workspace" title="Driver dashboard" description="Complete verification before becoming eligible for ride offers.">
      <DashboardCard title="Onboarding"><p>Provide your personal, vehicle, and required document details.</p><Link className="button button-primary" href="/driver/onboarding">Open onboarding</Link></DashboardCard>
      <DashboardCard title="Ride access"><p>Ride offers remain unavailable until verification and eligibility checks are implemented.</p></DashboardCard>
    </Dashboard>
  );
}
