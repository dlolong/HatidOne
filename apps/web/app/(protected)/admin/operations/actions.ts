'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { MockPaymentProvider } from '@hatidone/core';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isUuid, parseConfiguration } from '@/lib/admin/validation';
import { isIsolatedDemoEnvironment } from '@/lib/operations/capabilities';
const target = '/admin/operations';
function field(form: FormData, key: string): string { const value = form.get(key); return typeof value === 'string' ? value.trim() : ''; }
async function run(rpc: string, args: Record<string, unknown>, section: 'overview' | 'verification' | 'safety' | 'business' | 'system' = 'overview') {
  await requireRole('admin');
  const client = await createClient();
  let failed = false;
  try { const { error } = await client.rpc(rpc, args); failed = !!error; } catch { failed = true; }
  if (failed) redirect(`${target}?error=${encodeURIComponent('Action could not be completed. Check eligibility, access and field values.')}#${section}`);
  revalidatePath(target);
  revalidatePath('/admin');
  redirect(`${target}?message=Changes%20saved.#${section}`);
}
export async function reviewDriver(form: FormData) {
  await requireRole('admin');
  const id = field(form, 'driver_id');
  const decision = field(form, 'decision');
  const reason = field(form, 'reason');
  const destination = isUuid(id) && field(form, 'return_to') === 'driver' ? `/admin/drivers/${id}` : '/admin/drivers';
  if (!isUuid(id) || !['verified', 'rejected', 'suspended'].includes(decision) || reason.length > 1000 || (decision !== 'verified' && reason.length < 3)) {
    redirect(`${destination}?error=${encodeURIComponent('Choose a valid decision and provide a clear reason for corrections or suspension.')}`);
  }
  const client = await createClient();
  let failure = '';
  try {
    const { error } = await client.rpc('admin_review_driver', { p_driver_id: id, p_decision: decision, p_reason: reason || null });
    if (error) failure = error.message.includes('finish or cancel active passenger bookings')
      ? 'Approval is waiting for this applicant’s active passenger bookings to finish or be cancelled. Their submitted application and passenger access are preserved.'
      : 'Driver review could not be saved. Check the submitted application, account status and current documents.';
  } catch { failure = 'Driver review could not be saved. Reload the application and check its status before retrying.'; }
  if (failure) redirect(`${destination}?error=${encodeURIComponent(failure)}`);
  for (const path of [target, '/admin', '/admin/drivers', `/admin/drivers/${id}`]) revalidatePath(path);
  redirect(`${destination}?message=Driver%20review%20saved.`);
}
export async function manageSubscription(form: FormData) { return run('admin_manage_subscription', { p_payload: { organization_id: field(form, 'organization_id'), plan_id: field(form, 'plan_id'), status: field(form, 'status'), expires_at: field(form, 'expires_at') ? `${field(form, 'expires_at')}T23:59:59+08:00` : null, billing_status: field(form, 'billing_status') } }, 'business'); }
export async function updateConfiguration(form: FormData) {
  await requireRole('admin');
  const values = parseConfiguration(form);
  if (!values) redirect(`${target}?error=${encodeURIComponent('Complete all configuration fields within the displayed limits. At least one matching weight must be greater than zero.')}#system`);
  return run('admin_update_config', { p_payload: values }, 'system');
}
export async function setBackup(form: FormData) { return run('admin_set_backup_driver', { p_ride_request_id: field(form, 'ride_id'), p_driver_id: field(form, 'driver_id'), p_vehicle_id: field(form, 'vehicle_id') }, 'safety'); }
export async function activateBackup(form: FormData) { return run('admin_activate_backup', { p_ride_request_id: field(form, 'ride_id') }, 'safety'); }
export async function resolveSafety(form: FormData) { return run('admin_resolve_safety_report', { p_report_id: field(form, 'report_id'), p_status: field(form, 'status'), p_note: field(form, 'note') }, 'safety'); }
export async function simulatePayment(form: FormData) {
  await requireRole('admin');
  const client = await createClient();
  const { data: config } = await client.from('app_config').select('demo_mode,mock_payment_enabled,integrations_enabled').single();
  const enabled = isIsolatedDemoEnvironment() && config?.demo_mode === true && config?.mock_payment_enabled === true && config?.integrations_enabled === true;
  const status = field(form, 'status');
  if (!enabled || !['pending', 'paid', 'failed', 'refunded'].includes(status)) redirect(`${target}?error=Demo%20payments%20are%20disabled.#system`);
  const provider = new MockPaymentProvider({ environment: process.env.HATIDONE_ENVIRONMENT ?? 'production', demoMode: enabled, mockPaymentEnabled: enabled });
  const event = await provider.simulate({ eventId: field(form, 'event_id') || randomUUID(), bookingId: field(form, 'ride_id'), status: status as 'pending' | 'paid' | 'failed' | 'refunded' });
  return run('record_mock_payment_event', { p_ride_request_id: event.bookingId, p_status: event.status, p_event_id: event.eventId }, 'system');
}

export async function setReleaseControls(form: FormData) {
  return run('admin_set_release_controls', { p_bookings_paused: field(form, 'bookings_paused') === 'on', p_service_area_open: field(form, 'service_area_open') === 'on', p_integrations_enabled: field(form, 'integrations_enabled') === 'on', p_reason: field(form, 'reason') }, 'system');
}
export async function reviewQuote(form: FormData) {
  return run('admin_review_ride_quote', { p_ride_request_id: field(form, 'ride_id'), p_expected_version: Number(field(form, 'quote_version')), p_amount: field(form, 'amount'), p_duration_seconds: Number(field(form, 'duration_minutes')) * 60, p_reason: field(form, 'reason') });
}
export async function recordCashReview(form: FormData) {
  return run('record_cash_collection', { p_ride_request_id: field(form, 'ride_id'), p_operation_id: field(form, 'operation_id'), p_kind: field(form, 'kind'), p_amount: field(form, 'amount'), p_note: field(form, 'note') });
}
export async function reassignRide(form: FormData) {
  return run('rc1_reassign_ride', { p_ride_request_id: field(form, 'ride_id'), p_driver_id: field(form, 'driver_id'), p_vehicle_id: field(form, 'vehicle_id'), p_expected_assignment_version: Number(field(form, 'assignment_version')), p_reason: field(form, 'reason') });
}
