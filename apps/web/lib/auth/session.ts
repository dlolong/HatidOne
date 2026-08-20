import type { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  dashboardPathForRole,
  isActiveAccountStatus,
  isAppRole,
  type AppRole,
} from './roles';

export type AuthenticatedProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: AppRole;
};

export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect('/login?message=Please%20sign%20in%20to%20continue.');
  return user;
}

export async function requireProfile(): Promise<AuthenticatedProfile> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, account_status')
    .eq('id', user.id)
    .single();

  if (error || !data) redirect('/auth/profile-error');
  if (!isAppRole(data.role)) redirect('/auth/profile-error?reason=unsupported-role');
  if (!isActiveAccountStatus(data.account_status)) {
    redirect('/auth/profile-error?reason=inactive-account');
  }
  return { ...data, role: data.role };
}

export async function requireRole(expectedRole: AppRole): Promise<AuthenticatedProfile> {
  const profile = await requireProfile();
  if (profile.role !== expectedRole) redirect(dashboardPathForRole(profile.role));
  return profile;
}
