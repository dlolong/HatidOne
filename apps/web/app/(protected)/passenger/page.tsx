import Link from 'next/link';
import { BookingCard } from '@/components/booking-card';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { requireRole } from '@/lib/auth/session';
import { getPassengerBookings } from '@/lib/booking/data';

export default async function PassengerDashboard() {
  await requireRole('passenger');
  const bookings = await getPassengerBookings(2);
  return (
    <Dashboard eyebrow="Passenger workspace" title="Where to next?" description="Request scheduled transportation and keep track of every booking.">
      <DashboardCard title="Book a scheduled ride"><p>Choose pickup, drop-off, schedule, and vehicle type. Your fare estimate is calculated securely.</p><Link className="button button-primary" href="/book">Book a ride</Link></DashboardCard>
      <DashboardCard title="Account status"><p><span className="status-dot" /> Passenger profile ready</p><p className="muted">Only you can read your bookings.</p></DashboardCard>
      <div className="dashboard-wide"><div className="section-title-row"><h2>Recent bookings</h2><Link href="/history">View all</Link></div>{bookings.length === 0 ? <p className="large-empty compact-empty">No bookings yet. Your first requested ride will appear here.</p> : <div className="booking-list compact-booking-list">{bookings.map((booking) => <BookingCard booking={booking} key={booking.id} />)}</div>}</div>
    </Dashboard>
  );
}
