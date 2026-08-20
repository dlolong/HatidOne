import Link from 'next/link';
import { bookingStatusPresentation, formatPeso } from '@/lib/booking/booking';
import type { RideRequestSummary } from '@/lib/booking/data';

function formatSchedule(value: string | null): string {
  if (!value) return 'Schedule pending';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

export function BookingCard({ booking }: { booking: RideRequestSummary }) {
  const status = bookingStatusPresentation(booking.status);
  return (
    <article className="booking-card">
      <div className="booking-card-top">
        <span className={`status-pill ride-status-${status.tone}`}>{status.label}</span>
        <strong>{formatPeso(booking.estimated_fare)}</strong>
      </div>
      <p className="booking-schedule">{formatSchedule(booking.scheduled_at)}</p>
      <div className="route-summary">
        <p><span className="route-dot route-pickup" /><span><small>Pickup</small>{booking.pickup_address}</span></p>
        <p><span className="route-dot route-dropoff" /><span><small>Drop-off</small>{booking.dropoff_address}</span></p>
      </div>
      <Link className="booking-link" href={`/booking/${booking.id}`}>View booking →</Link>
    </article>
  );
}
