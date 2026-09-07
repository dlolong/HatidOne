import 'server-only';
import { requireProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export type Organization = { id: string; kind: 'fleet' | 'partner' | 'corporate'; name: string; owner_user_id: string; partner_type: string | null };
export type OrganizationMember = { id: string; user_id: string; member_role: string; status: string };
export type OrganizationLocation = { id: string; label: string; address: string; latitude: number | null; longitude: number | null };
export type OrganizationRide = { id: string; passenger_id: string; pickup_address: string; dropoff_address: string; scheduled_at: string | null; status: string; passenger_count: number; estimated_fare: number | string | null; ride_purpose: string | null; external_reference: string | null };
export type Subscription = { id: string; organization_id: string; plan_id: string; status: string; expires_at: string | null; billing_status: string };
export type Plan = { id: string; audience: string; display_name: string; features: string[]; monthly_price_php: number | null };
export function money(value: number | string | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Pending';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));
}
export function dateTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not scheduled';
}
export async function getOrganizations(): Promise<Organization[]> {
  await requireProfile();
  const client = await createClient();
  const { data, error } = await client.from('organizations').select('id,kind,name,owner_user_id,partner_type').order('created_at').returns<Organization[]>();
  if (error) throw new Error('Business accounts could not be loaded. Apply the completion migration first.');
  return data ?? [];
}
export async function getOrganization(id: string) {
  const profile = await requireProfile();
  const client = await createClient();
  const { data: organization, error } = await client.from('organizations').select('id,kind,name,owner_user_id,partner_type').eq('id', id).returns<Organization[]>().maybeSingle();
  if (error) throw new Error('Business account could not be loaded.');
  if (!organization) return null;
  const [members, locations, rides, subscription, plans] = await Promise.all([
    client.from('organization_members').select('id,user_id,member_role,status').eq('organization_id', id).returns<OrganizationMember[]>(),
    client.from('organization_locations').select('id,label,address,latitude,longitude').eq('organization_id', id).returns<OrganizationLocation[]>(),
    client.from('ride_requests').select('id,passenger_id,pickup_address,dropoff_address,scheduled_at,status,passenger_count,estimated_fare,ride_purpose,external_reference').eq('organization_id', id).order('scheduled_at').limit(200).returns<OrganizationRide[]>(),
    client.from('organization_subscriptions').select('id,organization_id,plan_id,status,expires_at,billing_status').eq('organization_id', id).returns<Subscription[]>().maybeSingle(),
    client.from('subscription_plans').select('id,audience,display_name,features,monthly_price_php').eq('active', true).returns<Plan[]>(),
  ]);
  if ([members, locations, rides, subscription, plans].some(result => result.error)) throw new Error('Some business records could not be loaded. Try again.');
  const ownMembership = members.data?.find(member => member.user_id === profile.id && member.status === 'active');
  return { organization, profile, subscriptionExpired: !!subscription.data?.expires_at && Date.parse(subscription.data.expires_at) <= Date.now(), canManage: profile.role === 'admin' || organization.owner_user_id === profile.id || ['owner', 'manager'].includes(ownMembership?.member_role ?? ''), members: members.data ?? [], locations: locations.data ?? [], rides: rides.data ?? [], subscription: subscription.data, plans: plans.data ?? [] };
}
