import Link from 'next/link';
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
  return (
    <div className="booking-page">
      <Link className="back-link" href="/history">← Ride history</Link>
      {alerts.error ? <p className="notice notice-error" role="alert">{alerts.error}</p> : null}
      {alerts.message ? <p className="notice notice-success" role="status">{alerts.message}</p> : null}
      <header className="booking-detail-heading"><div><p className="eyebrow">Booking details</p><h1>{status.label}</h1><p>{status.detail}</p></div><span className={`status-pill ride-status-${status.tone}`}>{status.label}</span></header>
      <section className="route-card"><div className="route-stop"><span className="route-dot route-pickup" /><div><small>Pickup</small><h2>{booking.pickup_address}</h2></div></div><div className="route-line" /><div className="route-stop"><span className="route-dot route-dropoff" /><div><small>Drop-off</small><h2>{booking.dropoff_address}</h2></div></div></section>
      <div className="booking-detail-grid">
        <section className="detail-card"><h2>Trip plan</h2><dl><div><dt>Pickup time</dt><dd>{formatDate(booking.scheduled_at)}</dd></div><div><dt>Vehicle</dt><dd>{booking.vehicle_type}</dd></div><div><dt>Estimated distance</dt><dd>{booking.estimated_distance_meters === null ? 'Pending' : `${(booking.estimated_distance_meters / 1000).toFixed(1)} km`}</dd></div><div><dt>Estimated duration</dt><dd>{booking.estimated_duration_seconds === null ? 'Pending' : `${Math.ceil(booking.estimated_duration_seconds / 60)} min`}</dd></div></dl></section>
        <section className="detail-card fare-card"><h2>Fare estimate</h2><strong>{formatPeso(booking.estimated_fare)}</strong><p>Placeholder estimate calculated server-side. Final regulated pricing may differ when the production pricing service is introduced.</p></section>
        <section className="detail-card"><h2>Passenger notes</h2><p>{booking.passenger_notes || 'No passenger notes provided.'}</p></section>
        <section className="detail-card"><h2>Status history</h2>{events.length === 0 ? <p className="empty-state">No status events available.</p> : <ol className="event-list">{events.map((event) => <li key={event.id}><span className="status-dot" /><div><strong>{bookingStatusPresentation(event.to_status).label}</strong><small>{formatDate(event.created_at)}</small></div></li>)}</ol>}</section>
      </div>
      {canPassengerCancel(booking.status) ? <section className="cancel-card"><div><h2>Need to cancel?</h2><p>Cancellation is recorded immediately and cannot be undone.</p></div><form action={cancelBooking}><input name="bookingId" type="hidden" value={booking.id} /><SubmitButton pendingLabel="Cancelling…">Cancel booking</SubmitButton></form></section> : null}
    </div>
  );
}
