'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { MockPaymentProvider } from '@hatidone/core';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
const target = '/admin/operations';
function field(form: FormData, key: string): string { const value = form.get(key); return typeof value === 'string' ? value.trim() : ''; }
async function run(rpc: string, args: Record<string, unknown>) {
  await requireRole('admin');
  const client = await createClient();
  const { error } = await client.rpc(rpc, args);
  revalidatePath(target);
  if (error) redirect(`${target}?error=${encodeURIComponent('Action could not be completed. Check eligibility, access and field values.')}`);
  redirect(`${target}?message=Changes%20saved.`);
}
export async function reviewDriver(form: FormData) { return run('admin_review_driver', { p_driver_id: field(form, 'driver_id'), p_decision: field(form, 'decision'), p_reason: field(form, 'reason') || null }); }
export async function manageSubscription(form: FormData) { return run('admin_manage_subscription', { p_payload: { organization_id: field(form, 'organization_id'), plan_id: field(form, 'plan_id'), status: field(form, 'status'), expires_at: field(form, 'expires_at') ? `${field(form, 'expires_at')}T23:59:59+08:00` : null, billing_status: field(form, 'billing_status') } }); }
export async function updateConfiguration(form: FormData) {
  const keys = ['driver_commission_percent', 'default_matching_radius_km', 'offer_timeout_seconds', 'scheduled_confirmation_hours', 'mock_route_speed_kph'];
  const values: Record<string, number | boolean | Record<string, number>> = {};
  for (const key of keys) values[key] = Number(field(form, key));
  values.matching_weights = Object.fromEntries(['distance','reliability','going_home','return_trip','idle','preferences'].map(key=>[key,Number(field(form,`weight_${key}`))]));
  values.backup_driver_enabled = field(form, 'backup_driver_enabled') === 'on';
  return run('admin_update_config', { p_payload: values });
}
export async function setBackup(form: FormData) { return run('admin_set_backup_driver', { p_ride_request_id: field(form, 'ride_id'), p_driver_id: field(form, 'driver_id'), p_vehicle_id: field(form, 'vehicle_id') }); }
export async function activateBackup(form: FormData) { return run('admin_activate_backup', { p_ride_request_id: field(form, 'ride_id') }); }
export async function resolveSafety(form: FormData) { return run('admin_resolve_safety_report', { p_report_id: field(form, 'report_id'), p_status: field(form, 'status'), p_note: field(form, 'note') }); }
export async function simulatePayment(form: FormData) {
  await requireRole('admin');
  const client = await createClient();
  const { data: config } = await client.from('app_config').select('demo_mode,mock_payment_enabled').single();
  const enabled = process.env.HATIDONE_DEMO_MODE === 'true' && config?.demo_mode === true && config?.mock_payment_enabled === true;
  const status = field(form, 'status');
  if (!enabled || !['pending', 'paid', 'failed', 'refunded'].includes(status)) redirect(`${target}?error=Demo%20payments%20are%20disabled.`);
  const provider = new MockPaymentProvider({ environment: process.env.NODE_ENV ?? 'production', demoMode: enabled, mockPaymentEnabled: enabled });
  const event = await provider.simulate({ eventId: field(form, 'event_id') || randomUUID(), bookingId: field(form, 'ride_id'), status: status as 'pending' | 'paid' | 'failed' | 'refunded' });
  return run('record_mock_payment_event', { p_ride_request_id: event.bookingId, p_status: event.status, p_event_id: event.eventId });
}
