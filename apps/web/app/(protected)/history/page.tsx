import Link from 'next/link';
import { BookingCard } from '@/components/booking-card';
import { getPassengerBookings } from '@/lib/booking/data';

type HistoryPageProps = { searchParams: Promise<{ error?: string }> };

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const [bookings, { error }] = await Promise.all([getPassengerBookings(), searchParams]);
  return (
    <div className="booking-page">
      <header className="list-heading"><div><p className="eyebrow">Passenger workspace</p><h1>Ride history</h1><p>All scheduled requests in your account, newest schedule first.</p></div><Link className="button button-primary" href="/book">Book a ride</Link></header>
      {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
      {bookings.length === 0 ? <section className="large-empty"><h2>No bookings yet</h2><p>Create your first scheduled ride request when you’re ready.</p><Link className="button button-primary" href="/book">Book your first ride</Link></section> : <div className="booking-list">{bookings.map((booking) => <BookingCard booking={booking} key={booking.id} />)}</div>}
    </div>
  );
}
