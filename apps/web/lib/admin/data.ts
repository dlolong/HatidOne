import 'server-only';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { driverQueueFilters } from './validation';

const overviewLabels = {
  unassigned: 'Unassigned bookings', quotes: 'Operator quotes needed',
  safety: 'Open safety reports', reviews: 'Applications awaiting review',
  active: 'Active trips', upcoming: 'Upcoming assigned rides', overdue: 'Pickup time passed',
};
type OverviewMetric = keyof typeof overviewLabels;
type CountResult = { count: number | null; error: { code?: string } | null };

export async function getAdminOverview() {
  const profile = await requireRole('admin');
  const client = await createClient();
  const now = new Date().toISOString();
  // GET with limit(0) returns no records and retains PostgREST error codes.
  // HEAD discards the error body, hiding missing-schema and access failures.
  const queries = {
    unassigned: client.from('ride_requests').select('id', { count: 'exact' }).limit(0).in('status', ['requested','searching','offered']),
    quotes: client.from('ride_requests').select('id', { count: 'exact' }).limit(0).in('status', ['requested','searching','offered']).eq('quote_status', 'pending_review'),
    safety: client.from('safety_reports').select('id', { count: 'exact' }).limit(0).neq('status', 'resolved'),
    reviews: client.from('driver_profiles').select('id', { count: 'exact' }).limit(0).eq('verification_status', 'under_review'),
    active: client.from('ride_requests').select('id', { count: 'exact' }).limit(0).in('status', ['driver_en_route','driver_arrived','trip_started']),
    upcoming: client.from('ride_requests').select('id', { count: 'exact' }).limit(0).eq('status', 'assigned').gte('scheduled_at', now),
    overdue: client.from('ride_requests').select('id', { count: 'exact' }).limit(0).eq('status', 'assigned').lt('scheduled_at', now),
  };
  const counts: Record<OverviewMetric, number | null> = {
    unassigned: null, quotes: null, safety: null, reviews: null, active: null, upcoming: null, overdue: null,
  };
  const unavailable: { metric: OverviewMetric; label: string; reason: 'schema' | 'unavailable' }[] = [];
  const keys = Object.keys(queries) as OverviewMetric[];
  const results = await Promise.allSettled<CountResult>(keys.map(key => queries[key]));
  results.forEach((result, index) => {
    const metric = keys[index];
    const value = result.status === 'fulfilled' ? result.value : null;
    if (value && !value.error && value.count !== null && Number.isInteger(value.count) && value.count >= 0) {
      counts[metric] = value.count;
    } else {
      const schema = ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(value?.error?.code ?? '');
      unavailable.push({ metric, label: overviewLabels[metric], reason: schema ? 'schema' : 'unavailable' });
    }
  });
  return { profile, now, ...counts, unavailable };
}

export async function getAdminDriverQueue(params: { status?: string; q?: string; page?: string }) {
  await requireRole('admin');
  const client = await createClient();
  const filters = driverQueueFilters(params);
  let userIds: string[] | null = null;
  if (filters.query) {
    const pattern = `%${filters.query.replaceAll('_', '\\_')}%`;
    const result = await client.from('profiles').select('id').or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`).limit(500);
    if (result.error) throw new Error('Applicant search could not be loaded.');
    userIds = result.data.map(row => row.id);
  }
  const pageSize = 25;
  let query = client.from('driver_profiles').select('id,user_id,verification_status,online,preferred_area,created_at', { count: 'exact' })
    .neq('verification_status', 'pending');
  if (filters.status !== 'all') query = query.eq('verification_status', filters.status);
  if (userIds) query = query.in('user_id', userIds);
  query = query.order('created_at', { ascending: false }).order('id');
  let result = await query.range((filters.page - 1) * pageSize, filters.page * pageSize - 1);
  const pageReset = filters.page > 1 && result.error?.code === 'PGRST103';
  // A queue can shrink between visits or after a review. Recover from a stale page.
  if (pageReset) { filters.page = 1; result = await query.range(0, pageSize - 1); }
  if (result.error) throw new Error('Driver applications could not be loaded.');
  const drivers = result.data ?? [];
  const people = drivers.length ? await client.from('profiles').select('id,first_name,last_name,email,account_status').in('id', drivers.map(driver => driver.user_id)) : { data: [], error: null };
  if (people.error) throw new Error('Applicant identities could not be loaded.');
  return { ...filters, pageReset, total: result.count ?? 0, pageSize, searchLimited: userIds?.length === 500, drivers: drivers.map(driver => ({ ...driver, person: people.data?.find(person => person.id === driver.user_id) })) };
}

export async function getAdminDriverReview(id: string) {
  await requireRole('admin');
  const client = await createClient();
  const driverResult = await client.from('driver_profiles').select('id,user_id,verification_status,preferred_area,online,created_at').eq('id', id).maybeSingle();
  if (driverResult.error) throw new Error('Driver application could not be loaded.');
  if (!driverResult.data) return null;
  const driver = driverResult.data;
  const [person, documents, vehicles, bookings] = await Promise.all([
    client.from('profiles').select('id,first_name,last_name,email,phone,role,account_status').eq('id', driver.user_id).single(),
    client.from('driver_documents').select('id,document_type,storage_path,expires_on,verification_status,rejection_reason').eq('driver_id', id),
    client.from('driver_vehicles').select('vehicle_id,is_primary,active').eq('driver_id', id),
    client.from('ride_requests').select('id', {count:'exact', head:true}).eq('passenger_id', driver.user_id).in('status', ['draft','requested','searching','offered','assigned','driver_en_route','driver_arrived','trip_started']),
  ]);
  if ([person, documents, vehicles, bookings].some(result => result.error)) throw new Error('Application details could not be loaded.');
  const ids = (vehicles.data ?? []).map(vehicle => vehicle.vehicle_id);
  const [vehicleRows, vehicleDocuments] = ids.length ? await Promise.all([
    client.from('vehicles').select('id,brand,model,year,color,plate_number,vehicle_type,capacity,verified,active').in('id', ids),
    client.from('vehicle_documents').select('id,vehicle_id,document_type,storage_path,expires_on,verification_status,rejection_reason').in('vehicle_id', ids),
  ]) : [{data:[],error:null},{data:[],error:null}];
  if (vehicleRows.error || vehicleDocuments.error) throw new Error('Vehicle details could not be loaded.');
  const records = [
    ...(documents.data ?? []).map(doc => ({ ...doc, bucket: 'driver-documents', vehicle_id: null as string | null })),
    ...(vehicleDocuments.data ?? []).map(doc => ({ ...doc, bucket: 'vehicle-documents' })),
  ];
  const links = await Promise.all(records.map(async doc => {
    const { data, error } = await client.storage.from(doc.bucket).createSignedUrl(doc.storage_path, 300);
    return { ...doc, url: !error ? data?.signedUrl : undefined };
  }));
  return { driver, person: person.data, activeBookings: bookings.count ?? 0, vehicles: (vehicleRows.data ?? []).map(vehicle => ({ ...vehicle, link: vehicles.data?.find(link => link.vehicle_id === vehicle.id) })), documents: links };
}
