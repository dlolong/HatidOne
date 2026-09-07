import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { BookingPlanner } from '@/components/booking-planner';
import { parseBookingIntent } from '@/lib/booking/partner-link';
export default async function BookPage({ searchParams }: { searchParams:Promise<Record<string,string|undefined>> }) {
  await requireRole('passenger');const query=await searchParams;const intent=parseBookingIntent(query);
  let rebook;
  if(query.rebook&&/^[0-9a-f-]{36}$/i.test(query.rebook)) { const client=await createClient();const {data}=await client.from('ride_requests').select('pickup_address,dropoff_address,pickup_latitude,pickup_longitude,dropoff_latitude,dropoff_longitude').eq('id',query.rebook).eq('status','trip_completed').maybeSingle();if(data)rebook={pickup:{address:data.pickup_address,lat:String(data.pickup_latitude),lng:String(data.pickup_longitude)},dropoff:{address:data.dropoff_address,lat:String(data.dropoff_latitude),lng:String(data.dropoff_longitude)}}; }
  return <div className="booking-page"><Link className="back-link" href="/passenger">← Passenger home</Link><header className="booking-heading"><p className="eyebrow">Scheduled transportation</p><h1>Where are you going?</h1><p>Choose a known service location or enter an address and coordinates. Preview a local estimate before confirming.</p></header>{query.error&&<p className="notice notice-error" role="alert">{query.error}</p>}<BookingPlanner requestId={randomUUID()} intent={intent} rebook={rebook} /></div>;
}
