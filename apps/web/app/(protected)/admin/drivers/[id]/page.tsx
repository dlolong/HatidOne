import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
export default async function DriverReview({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin'); const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const client = await createClient();
  const [driver, documents, vehicles] = await Promise.all([
    client.from('driver_profiles').select('id,verification_status,user_id').eq('id',id).maybeSingle(),
    client.from('driver_documents').select('id,document_type,storage_path,expires_on,verification_status').eq('driver_id',id),
    client.from('driver_vehicles').select('vehicle_id').eq('driver_id',id),
  ]);
  if (driver.error || documents.error || vehicles.error) throw new Error('Driver review could not be loaded.');
  if (!driver.data) notFound();
  const { data: vehicleDocuments, error } = vehicles.data?.length ? await client.from('vehicle_documents').select('id,document_type,storage_path,expires_on,verification_status').in('vehicle_id',vehicles.data.map(v => v.vehicle_id)) : { data: [], error: null };
  if (error) throw new Error('Vehicle documents could not be loaded.');
  const records = [...(documents.data ?? []).map(doc => ({ ...doc,bucket:'driver-documents' })),...(vehicleDocuments ?? []).map(doc => ({ ...doc,bucket:'vehicle-documents' }))];
  const links = await Promise.all(records.map(async doc => { const { data } = await client.storage.from(doc.bucket).createSignedUrl(doc.storage_path,300); return { ...doc,url:data?.signedUrl }; }));
  return <Dashboard eyebrow="Private driver review" title="Verification documents" description={`Application status: ${driver.data.verification_status}`}><Link href="/admin/operations#verification">Back to driver decisions</Link>{links.length ? links.map(doc => <DashboardCard title={doc.document_type.replaceAll('_',' ')} key={doc.id}><p>Status: {doc.verification_status}</p><p>Expires: {doc.expires_on ?? 'Not recorded'}</p>{doc.url ? <a className="button button-secondary" href={doc.url} target="_blank" rel="noreferrer">Open private document (5 minute link)</a> : <p role="alert">Document unavailable. Do not approve until it can be reviewed.</p>}</DashboardCard>) : <p>No documents have been submitted.</p>}</Dashboard>;
}
