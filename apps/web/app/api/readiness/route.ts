import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    const { data: profile } = await client.from('profiles').select('role,account_status').eq('id', user.id).single();
    if (profile?.role !== 'admin' || profile.account_status !== 'active') return Response.json({ error: 'Forbidden' }, { status: 403, headers });
    const { error: databaseError } = await client.from('app_config').select('id').single();
    return Response.json({ status: databaseError ? 'unavailable' : 'ready', checks: { authenticatedAdmin: true, configurationRead: !databaseError }, scope: 'Database configuration read only; external delivery, devices, backups and operations unverified.' }, { status: databaseError ? 503 : 200, headers });
  } catch {
    return Response.json({ error: 'Unavailable' }, { status: 503, headers });
  }
}
