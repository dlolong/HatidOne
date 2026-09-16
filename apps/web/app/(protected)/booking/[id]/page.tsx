import Link from 'next/link';
import { acceptReviewedQuote } from './actions';
import { createClient } from '@/lib/supabase/server';
import { LiveBooking } from '@/components/live-booking';
import { RideConversation } from '@/components/ride-conversation';
import { ConfirmForm } from '@/components/confirm-form';
import { CopyLink } from '@/components/copy-link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/submit-button';
import { bookingStatusPresentation, canPassengerCancel, formatPeso } from '@/lib/booking/booking';
import { getPassengerBooking } from '@/lib/booking/data';
import { cancelBooking } from '../../book/actions';

type BookingPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
};

function formatDate(value: string | null): string {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value));
}

export default async function BookingDetailPage({ params, searchParams }: BookingPageProps) {
  const [{ id }, alerts] = await Promise.all([params, searchParams]);
  const result = await getPassengerBooking(id);
  if (!result) notFound();
  const { booking, events } = result;
  const status = bookingStatusPresentation(booking.status);
  const assigned = ['assigned','driver_en_route','driver_arrived','trip_started','trip_completed'].includes(booking.status);
  const client=await createClient();
  const {data:driver}=assigned?await client.rpc('get_assigned_driver',{p_ride_request_id:id}):{data:null};
  const {data:pin}=['assigned','driver_en_route','driver_arrived'].includes(booking.status)?await client.rpc('get_passenger_trip_pin',{p_ride_request_id:id}):{data:null};
  const [quoteState, quotes, cash, assignment] = await Promise.all([
    client.from('ride_requests').select('quote_status,quote_version').eq('id', id).single(),
    client.from('ride_quotes').select('version,amount,currency,breakdown,reason,duration_seconds').eq('ride_request_id', id).order('version', { ascending: false }).limit(1),
    client.from('cash_collection_events').select('id,kind,amount,currency,created_at').eq('ride_request_id', id).order('created_at'),
    client.from('ride_assignments').select('confirmed_at').eq('ride_request_id', id).maybeSingle(),
  ]);
  if ([quoteState, quotes, cash, assignment].some(result => result.error)) throw new Error('Quote and collection status could not be loaded. Please refresh.');
  const quote = quotes.data?.[0];
  return (
    <div className="booking-page">
      <Link className="back-link" href="/history">← Ride history</Link>
      {alerts.error ? <p className="notice notice-error" role="alert">{alerts.error}</p> : null}
      {alerts.message ? <p className="notice notice-success" role="status">{alerts.message}</p> : null}
      <header className="booking-detail-heading"><div><p className="eyebrow">Booking details</p><h1>{status.label}</h1><p>{status.detail}</p></div><span className={`status-pill ride-status-${status.tone}`}>{status.label}</span></header>
      <LiveBooking id={id} />
      <section className="route-card"><div className="route-stop"><span className="route-dot route-pickup" /><div><small>Pickup</small><h2>{booking.pickup_address}</h2></div></div><div className="route-line" /><div className="route-stop"><span className="route-dot route-dropoff" /><div><small>Drop-off</small><h2>{booking.dropoff_address}</h2></div></div></section>
      {driver && <section className="detail-card"><h2>Your assigned driver</h2><p>{driver.name} · {driver.verification_status}</p><p>{assignment.data?.confirmed_at ? `Driver reconfirmed ${formatDate(assignment.data.confirmed_at)}` : 'Awaiting driver reconfirmation. Assignment alone does not confirm readiness.'}</p><p>{driver.brand} {driver.model} · {driver.color} · {driver.plate_number}</p><p>{driver.rating_count ? `${driver.rating} rating from ${driver.rating_count} reviews` : 'Rating history still building'}</p>{pin && <p>Passenger PIN: <strong className="pickup-pin">{pin}</strong>. Share with your driver only when you are ready to start.</p>}</section>}
      {assigned && <RideConversation id={id} />}
      <div className="booking-detail-grid">
        <section className="detail-card"><h2>Trip plan</h2><dl><div><dt>Pickup time</dt><dd>{formatDate(booking.scheduled_at)}</dd></div><div><dt>Vehicle</dt><dd>{booking.vehicle_type}</dd></div><div><dt>Estimated distance</dt><dd>{booking.estimated_distance_meters === null ? 'Pending' : `${(booking.estimated_distance_meters / 1000).toFixed(1)} km`}</dd></div><div><dt>Estimated duration</dt><dd>{booking.estimated_duration_seconds === null ? 'Pending' : `${Math.ceil(booking.estimated_duration_seconds / 60)} min`}</dd></div></dl></section>
        <section className="detail-card fare-card"><h2>{quoteState.data?.quote_status === 'accepted' ? 'Agreed fare' : 'Quote review'}</h2><strong>{formatPeso(quote?.amount ?? booking.estimated_fare)}</strong>
          <p>{quoteState.data?.quote_status === 'pending_review' ? 'An operator must review your addresses, route and price. Your request is not a confirmed ride.' : `Quote ${quoteState.data?.quote_status?.replaceAll('_',' ')} · version ${quoteState.data?.quote_version}`}</p>
          {quote && <><p>{quote.reason}</p><p>Currency: {quote.currency} · Operator-reviewed duration: {Math.ceil(quote.duration_seconds / 60)} minutes. This is not a promised arrival time.</p><dl>{Object.entries(quote.breakdown ?? {}).filter(([,value]) => ['string','number'].includes(typeof value)).map(([key,value]) => <div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{String(value)}</dd></div>)}</dl></>}
          {quoteState.data?.quote_status === 'offered' && quote && <form action={acceptReviewedQuote}><input type="hidden" name="ride_id" value={id}/><input type="hidden" name="quote_version" value={quote.version}/><SubmitButton pendingLabel="Accepting…">Accept this quote</SubmitButton></form>}
          {quoteState.data?.quote_status === 'demo' && <p>DEMO estimate only. Not an authorized real fare.</p>}
        </section>
        <section className="detail-card"><h2>Cash collection</h2><p>Trip completion does not mean payment collected. Cash is recorded manually and is not gateway verified.</p>{cash.data?.length ? cash.data.map(event => <p key={event.id}>{event.kind.replaceAll('_',' ')} · {formatPeso(event.amount)} {event.currency} · {formatDate(event.created_at)}</p>) : <p>No cash collection recorded.</p>}</section>
        <section className="detail-card"><h2>Passenger notes</h2><p>{booking.passenger_notes || 'No passenger notes provided.'}</p></section>
        <section className="detail-card"><h2>Status history</h2>{events.length === 0 ? <p className="empty-state">No status events available.</p> : <ol className="event-list">{events.map((event) => <li key={event.id}><span className="status-dot" /><div><strong>{bookingStatusPresentation(event.to_status).label}</strong><small>{formatDate(event.created_at)}</small></div></li>)}</ol>}</section>
      </div>
      <section className="detail-card"><h2>Share booking reference</h2><CopyLink path={`/booking/${id}`} /><p>The link does not grant access to private trip details or live location.</p>{booking.status==='trip_completed' && <Link className="button button-primary" href={`/book?rebook=${id}`}>Rebook this trip</Link>}</section>
      {canPassengerCancel(booking.status) ? <section className="cancel-card"><div><h2>Need to cancel?</h2><p>Cancellation is recorded immediately and cannot be undone.</p></div><ConfirmForm action={cancelBooking} message="Cancel this booking? This cannot be undone."><input name="bookingId" type="hidden" value={booking.id} /><SubmitButton pendingLabel="Cancelling…">Cancel booking</SubmitButton></ConfirmForm></section> : null}
    </div>
  );
}
