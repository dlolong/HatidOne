import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/auth/roles';

export default async function DashboardRouterPage() {
  const profile = await requireProfile();
  redirect(dashboardPathForRole(profile.role));
}
