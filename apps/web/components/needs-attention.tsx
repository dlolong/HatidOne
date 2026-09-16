import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { requireProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { dateTime, money } from '@/lib/operations/data';
import { ConfirmForm } from './confirm-form';
import { SubmitButton } from './submit-button';
import { reviewQuote, recordCashReview, reassignRide } from '@/app/(protected)/admin/operations/actions';

export async function NeedsAttention() {
  const actor = await requireProfile();
  if (!['admin', 'fleet_admin'].includes(actor.role)) return null;
  const admin = actor.role === 'admin';
  const client = await createClient();
  const [rides, assignments, documents, payments, incidents, collections, deletions] = await Promise.all([
    client.from('ride_requests').select('id,pickup_address,dropoff_address,status,scheduled_at,updated_at,quote_status,quote_version,gross_fare').in('status', ['requested','searching','offered','assigned','driver_en_route','driver_arrived','trip_started','driver_cancelled','no_show','trip_completed']).order('scheduled_at').limit(200),
    client.from('ride_assignments').select('ride_request_id,confirmed_at,assignment_version').limit(200),
    client.from('driver_documents').select('id,driver_id,document_type,expires_on').lte('expires_on', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())).limit(200),
    client.from('payments').select('ride_request_id,status,provider').eq('provider','cash').limit(200),
    client.from('safety_reports').select('id,ride_request_id,category,status').neq('status','resolved').limit(200),
    client.from('cash_collection_events').select('id,ride_request_id,kind,amount,currency,note,created_at').order('created_at', { ascending: false }).limit(200),
    admin ? client.from('account_deletion_requests').select('id,user_id,status,reason,created_at').neq('status','completed').order('created_at').limit(200) : Promise.resolve({ data: [], error: null }),
  ]);
  if ([rides, assignments, documents, payments, incidents, collections, deletions].some(result => result.error)) throw new Error('Needs Attention could not be loaded. Refresh after checking backend compatibility.');
  const now = new Date().getTime();
  const awaiting = new Set((assignments.data ?? []).filter(row => !row.confirmed_at).map(row => row.ride_request_id));
  const pendingCash = new Set((payments.data ?? []).filter(row => row.status !== 'paid').map(row => row.ride_request_id));
  const disputed = new Set((collections.data ?? []).filter(row => row.kind === 'disputed').map(row => row.ride_request_id));
  const needs = (rides.data ?? []).map(ride => {
    const reasons: string[] = [];
    if (ride.quote_status === 'pending_review') reasons.push('Operator quote required');
    else if (ride.quote_status === 'offered') reasons.push('Passenger quote acceptance pending');
    if (['requested','searching','offered'].includes(ride.status)) reasons.push('Unassigned');
    if (ride.status === 'assigned') reasons.push(awaiting.has(ride.id) ? 'Driver reconfirmation pending' : 'Upcoming assigned ride — monitor coverage');
    if (['driver_cancelled','no_show'].includes(ride.status)) reasons.push(ride.status.replaceAll('_',' '));
    if (['driver_en_route','driver_arrived','trip_started'].includes(ride.status) && now - Date.parse(ride.updated_at) > 30 * 60_000) reasons.push('No trip state change for 30 minutes — contact participants; this does not measure GPS freshness');
    if (ride.status === 'trip_completed' && (pendingCash.has(ride.id) || !(payments.data ?? []).some(row => row.ride_request_id === ride.id))) reasons.push('Cash collection not reconciled');
    if (disputed.has(ride.id)) reasons.push('Cash dispute recorded — review audit');
    return { ...ride, reasons };
  }).filter(ride => ride.reasons.length);
  return <section className="dashboard-card dashboard-wide" id="needs-attention">
    <h2>Needs Attention</h2>
    <p>Manual queue · Loaded {dateTime(new Date().toISOString())} (Asia/Manila). Refresh for current state. Up to 200 records per category; this view does not guarantee exhaustive coverage.</p>
    {!needs.length && !documents.data?.length && !incidents.data?.length && !deletions.data?.length && <p>No exceptions in the loaded records.</p>}
    {needs.map(ride => <details key={ride.id}><summary>{ride.pickup_address} → {ride.dropoff_address} · {ride.reasons.join(' · ')}</summary>
      <p>Reference {ride.id} · {dateTime(ride.scheduled_at)} · {ride.status.replaceAll('_',' ')} · quote v{ride.quote_version} · {money(ride.gross_fare)}</p>
      {admin && ['requested','searching','offered'].includes(ride.status) && <Link href={`/admin/dispatch?ride=${ride.id}`}>Review eligible drivers</Link>}
      {admin && ['requested','searching','offered'].includes(ride.status) && ride.quote_status !== 'accepted' && <form action={reviewQuote} className="compact-form">
        <input type="hidden" name="ride_id" value={ride.id}/><input type="hidden" name="quote_version" value={ride.quote_version}/>
        <label>Reviewed total (PHP)<input name="amount" type="number" min="0.01" step="0.01" required/></label>
        <label>Occupied route duration (minutes)<input name="duration_minutes" type="number" min="1" max="1440" required/></label>
        <label>Quote explanation, inclusions and route uncertainty<textarea name="reason" minLength={5} maxLength={2000} required/></label>
        <p>Verify the route and pickup/drop-off with the passenger. Include agreed toll handling. The passenger must accept this version before assignment.</p>
        <SubmitButton pendingLabel="Saving quote…">Offer reviewed quote</SubmitButton>
      </form>}
      {admin && ride.status === 'assigned' && <details><summary>Review pre-departure reassignment</summary><p>Only available before the driver heads to pickup. Confirm the replacement with both parties. Eligibility and schedule conflicts are rechecked; the old PIN is revoked and the replacement must reconfirm.</p><ConfirmForm action={reassignRide} message="Replace this assigned driver before departure? The pickup PIN will change and the replacement must reconfirm."><input type="hidden" name="ride_id" value={ride.id}/><input type="hidden" name="assignment_version" value={(assignments.data ?? []).find(row => row.ride_request_id === ride.id)?.assignment_version ?? -1}/><label>Replacement driver full ID<input name="driver_id" required/></label><label>Replacement vehicle full ID<input name="vehicle_id" required/></label><label>Reason and scheduling review<textarea name="reason" minLength={5} maxLength={2000} required/></label><SubmitButton pendingLabel="Reassigning…">Reassign before departure</SubmitButton></ConfirmForm></details>}
      {ride.status === 'trip_completed' && <><h3>Cash audit</h3>{(collections.data ?? []).filter(row => row.ride_request_id === ride.id).map(row => <p key={row.id}>{row.kind} · {money(row.amount)} · {dateTime(row.created_at)} · {row.note}</p>)}
        {admin && <form action={recordCashReview} className="compact-form"><input type="hidden" name="ride_id" value={ride.id}/><input type="hidden" name="operation_id" value={randomUUID()}/><label>Review<select name="kind"><option value="reconciled">Reconciled</option><option value="disputed">Disputed</option></select></label><label>Verified amount (PHP)<input name="amount" type="number" min="0" step="0.01" required/></label><label>Evidence and reason<textarea name="note" minLength={5} maxLength={2000} required/></label><SubmitButton pendingLabel="Recording…">Record cash review</SubmitButton></form>}
      </>}
    </details>)}
    {!!documents.data?.length && <><h3>Expired or expiring today: driver documents</h3>{documents.data.map(doc => <p key={doc.id}>{doc.document_type.replaceAll('_',' ')} · driver {doc.driver_id.slice(0,8)} · {doc.expires_on}{admin && <> · <Link href={`/admin/drivers/${doc.driver_id}`}>Review driver</Link></>}</p>)}</>}
    {!!incidents.data?.length && <><h3>Unresolved incidents</h3>{incidents.data.map(incident => <p key={incident.id}>{incident.category} · {incident.status} · booking {incident.ride_request_id.slice(0,8)}</p>)}{admin && <p>Use Safety &amp; backup to record an authorized review.</p>}</>}
    {!!deletions.data?.length && <><h3>Account deletion requests</h3><p>Requests are recorded only. Do not delete audit/transaction records or mark completion until the retention policy and authorized account processing are approved.</p>{deletions.data.map(request => <p key={request.id}>User {request.user_id.slice(0,8)} · {request.status} · {dateTime(request.created_at)} · {request.reason}</p>)}</>}
  </section>;
}
