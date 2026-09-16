import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { StatusPill } from '@/components/ui';
import { AdminDriverDecision } from '@/components/admin-driver-decision';
import { getAdminDriverReview } from '@/lib/admin/data';
import { isUuid } from '@/lib/admin/validation';
import { dateTime } from '@/lib/operations/data';
export default async function DriverReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{error?:string;message?:string}> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [review, alerts] = await Promise.all([getAdminDriverReview(id),searchParams]);
  if (!review) notFound();
  const { driver, person, documents, vehicles, activeBookings } = review;
  const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ') || 'Driver application';
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const primary = vehicles.find(vehicle=>vehicle.link?.is_primary && vehicle.link.active);
  const current = (expires: string | null) => !expires || expires >= today;
  const missing: string[] = [];
  if (!primary) missing.push('No active primary vehicle is linked.');
  if (!documents.some(doc=>doc.bucket==='driver-documents'&&doc.document_type==='drivers_license'&&current(doc.expires_on)&&doc.url)) missing.push('A readable, current driver’s license is required.');
  if (!documents.some(doc=>doc.bucket==='vehicle-documents'&&doc.vehicle_id===primary?.id&&doc.document_type==='registration'&&current(doc.expires_on)&&doc.url)) missing.push('Readable, current registration for the primary vehicle is required.');
  if (person?.account_status !== 'active') missing.push('The account is restricted. Resolve the account restriction before approval.');
  if (person?.role === 'passenger' && activeBookings) missing.push(`${activeBookings} active passenger booking(s) must finish or be cancelled before granting driver access.`);
  return <Dashboard eyebrow="Administration / Driver review" title={name} description="Check the applicant, primary vehicle and private documents before recording a decision.">
    <div className="dashboard-wide button-row"><Link className="button button-secondary" href="/admin/drivers">← Driver applications</Link><StatusPill status={driver.verification_status}/><span className="muted">Started {dateTime(driver.created_at)}</span></div>
    {alerts.error&&<p className="notice notice-error dashboard-wide" role="alert">{alerts.error}</p>}{alerts.message&&<p className="notice notice-success dashboard-wide" role="status">{alerts.message}</p>}
    <DashboardCard title="Applicant details"><dl className="admin-facts"><div><dt>Email</dt><dd>{person?.email ?? 'Not recorded'}</dd></div><div><dt>Phone</dt><dd>{person?.phone || 'Not recorded'}</dd></div><div><dt>Service area</dt><dd>{driver.preferred_area || 'Not recorded'}</dd></div><div><dt>Account</dt><dd>{person?.account_status ?? 'Unavailable'}</dd></div></dl><details><summary>Application reference</summary><p className="wrap-anywhere">{id}</p></details></DashboardCard>
    <DashboardCard title="Vehicles">{vehicles.length ? vehicles.map(vehicle=><article className="admin-vehicle" key={vehicle.id}><h3>{vehicle.brand} {vehicle.model} · {vehicle.plate_number}</h3><p>{vehicle.year} · {vehicle.color} · {vehicle.vehicle_type} · {vehicle.capacity} passengers</p><p>{vehicle.link?.is_primary?'Primary vehicle':'Additional vehicle'} · {vehicle.active&&vehicle.link?.active?'Active':'Inactive'} · {vehicle.verified?'Verified':'Not verified'}</p></article>):<p>No vehicle has been saved.</p>}</DashboardCard>
    <section className="dashboard-card dashboard-wide"><h2>Private documents</h2><p>Document links expire after five minutes. Reload this page to generate fresh links.</p>{!documents.length?<p>No documents have been uploaded.</p>:<div className="admin-document-grid">{documents.map(doc=><article className="admin-document" key={`${doc.bucket}-${doc.id}`}><h3>{doc.document_type.replaceAll('_',' ')}</h3><p>{doc.vehicle_id ? `Vehicle: ${vehicles.find(vehicle=>vehicle.id===doc.vehicle_id)?.plate_number ?? 'Linked vehicle'}` : 'Applicant document'}</p><StatusPill status={doc.verification_status}/><p>{doc.expires_on?`Expires ${doc.expires_on}`:'No expiration recorded'}</p>{!current(doc.expires_on)&&<p className="notice notice-error">Expired — replacement needed.</p>}{doc.rejection_reason&&<p>Reason: {doc.rejection_reason}</p>}{doc.url?<a className="button button-secondary" href={doc.url} target="_blank" rel="noreferrer">Open private document</a>:<p className="notice notice-error" role="alert">Document unavailable. Request a replacement before approval.</p>}</article>)}</div>}</section>
    <section className="dashboard-card dashboard-wide" id="decision"><h2>Review decision</h2>{missing.length>0&&<div className="notice"><strong>Before approval</strong><ul>{missing.map(reason=><li key={reason}>{reason}</li>)}</ul></div>}{driver.verification_status==='rejected'&&<p>The applicant must correct and resubmit before approval.</p>}<AdminDriverDecision id={id} status={driver.verification_status} approvalBlocked={missing.length>0}/></section>
  </Dashboard>;
}
