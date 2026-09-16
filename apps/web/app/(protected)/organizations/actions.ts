'use server';
import { isIsolatedDemoEnvironment } from '@/lib/operations/capabilities';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

function field(form: FormData, name: string): string { const value = form.get(name); return typeof value === 'string' ? value.trim() : ''; }
function optionalNumber(form: FormData, name: string): number | null { const value = field(form, name); return value && Number.isFinite(Number(value)) ? Number(value) : null; }
function path(form: FormData): string { const id = field(form, 'organization_id'); return /^[0-9a-f-]{36}$/i.test(id) ? `/organizations/${id}` : '/organizations'; }
async function execute(form: FormData, rpc: string, payload: Record<string, string | number | null>, message: string) {
  await requireProfile();
  const client = await createClient();
  const { error } = await client.rpc(rpc, { p_payload: payload });
  const target = path(form);
  revalidatePath(target);
  if (error) redirect(`${target}?error=${encodeURIComponent('The request could not be saved. Check your access and the entered details.')}`);
  redirect(`${target}?message=${encodeURIComponent(message)}`);
}
export async function createOrganization(form: FormData) {
  await requireProfile();
  const client = await createClient();
  const { data, error } = await client.rpc('create_organization', { p_payload: { name: field(form, 'name'), kind: field(form, 'kind'), partner_type: field(form, 'partner_type') || null } });
  if (error || typeof data !== 'string') redirect('/organizations?error=Business%20account%20could%20not%20be%20created.');
  revalidatePath('/organizations'); redirect(`/organizations/${data}?message=Business%20account%20created.`);
}
export async function saveMember(form: FormData) {
  return execute(form, 'save_organization_member', { organization_id: field(form, 'organization_id'), user_id: field(form, 'user_id') || null, email: field(form, 'email') || null, member_role: field(form, 'member_role'), status: field(form, 'status') }, 'Member saved.');
}
export async function saveLocation(form: FormData) {
  return execute(form, 'save_organization_location', { organization_id: field(form, 'organization_id'), label: field(form, 'label'), address: field(form, 'address'), latitude: optionalNumber(form, 'latitude'), longitude: optionalNumber(form, 'longitude') }, 'Location saved.');
}
export async function createTransport(form: FormData) {
  if (!isIsolatedDemoEnvironment()) redirect(`${path(form)}?error=Business%20requests%20are%20unavailable%20in%20this%20pilot.`);
  const scheduled = field(form, 'scheduled_at');
  return execute(form, 'create_transport_request', {
    organization_id: field(form, 'organization_id'), client_request_id: field(form, 'client_request_id'),
    pickup_address: field(form, 'pickup_address'), dropoff_address: field(form, 'dropoff_address'),
    pickup_lat: optionalNumber(form, 'pickup_lat'), pickup_lng: optionalNumber(form, 'pickup_lng'),
    dropoff_lat: optionalNumber(form, 'dropoff_lat'), dropoff_lng: optionalNumber(form, 'dropoff_lng'),
    scheduled_at: scheduled ? `${scheduled}:00+08:00` : null, vehicle_type: field(form, 'vehicle_type'),
    service_type: field(form, 'service_type'), passenger_count: optionalNumber(form, 'passenger_count'),
    ride_purpose: field(form, 'ride_purpose'), external_reference: field(form, 'external_reference'),
    passenger_id: field(form, 'passenger_id') || null, route_preference: field(form, 'route_preference') || 'fastest',
  }, 'Transport requested. Operations can now dispatch an eligible driver.');
}

export async function dispatchFleetRide(form: FormData) {
  await requireProfile(); const client=await createClient();
  const {error}=await client.rpc('rc1_manual_assign_ride',{p_ride_request_id:field(form,'ride_id'),p_driver_id:field(form,'driver_id'),p_vehicle_id:field(form,'vehicle_id'),p_expected_version:Number(field(form,'quote_version')),p_reason:field(form,'reason')});
  const target=path(form);revalidatePath(target);redirect(`${target}?${error?'error=Driver%20is%20not%20eligible%20for%20this%20ride.':'message=Driver%20assigned.%20Awaiting%20reconfirmation.'}`);
}
export async function linkFleetVehicle(form: FormData) {
  const profile=await requireProfile();if(profile.role!=='admin')redirect(`${path(form)}?error=Administrator%20review%20is%20required.`);
  const client=await createClient();const {error}=await client.rpc('admin_link_fleet_vehicle',{p_organization_id:field(form,'organization_id'),p_vehicle_id:field(form,'vehicle_id')});const target=path(form);revalidatePath(target);redirect(`${target}?${error?'error=Vehicle%20could%20not%20be%20linked.':'message=Vehicle%20linked.'}`);
}
