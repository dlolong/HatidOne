import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { requireProfile } from '@/lib/auth/session';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Account';
  return <AppShell name={name} role={profile.role}>{children}</AppShell>;
}
