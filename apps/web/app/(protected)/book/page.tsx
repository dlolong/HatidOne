import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireRole } from '@/lib/auth/session';
import { createBooking } from './actions';

type BookPageProps = {
  searchParams: Promise<{ error?: string }>;
};

function minimumSchedule(): string {
  const date = new Date(Date.now() + 31 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}

export default async function BookPage({ searchParams }: BookPageProps) {
  await requireRole('passenger');
  const { error } = await searchParams;
  return (
    <div className="booking-page">
      <Link className="back-link" href="/passenger">← Passenger dashboard</Link>
      <header className="booking-heading"><p className="eyebrow">Scheduled transportation</p><h1>Book a ride</h1><p>Enter exact location coordinates for this map-free MVP. Fare and route estimates are calculated by trusted server logic after submission.</p></header>
      {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
      <form action={createBooking} className="booking-form">
        <input name="requestId" type="hidden" value={randomUUID()} />
        <section className="booking-form-section"><span className="section-number">1</span><div><h2>Pickup and drop-off</h2><p>Use decimal latitude and longitude. Maps and address lookup are intentionally deferred.</p></div>
          <label>Pickup address<input maxLength={240} name="pickupAddress" placeholder="e.g. NAIA Terminal 3, Pasay" required /></label>
          <div className="form-grid"><label>Pickup latitude<input inputMode="decimal" max={90} min={-90} name="pickupLat" placeholder="14.5186" required step="any" type="number" /></label><label>Pickup longitude<input inputMode="decimal" max={180} min={-180} name="pickupLng" placeholder="121.0198" required step="any" type="number" /></label></div>
          <label>Drop-off address<input maxLength={240} name="dropoffAddress" placeholder="e.g. Ayala Center, Makati" required /></label>
          <div className="form-grid"><label>Drop-off latitude<input inputMode="decimal" max={90} min={-90} name="dropoffLat" placeholder="14.5520" required step="any" type="number" /></label><label>Drop-off longitude<input inputMode="decimal" max={180} min={-180} name="dropoffLng" placeholder="121.0235" required step="any" type="number" /></label></div>
        </section>
        <section className="booking-form-section"><span className="section-number">2</span><div><h2>Schedule and vehicle</h2><p>Pickup times use Philippine Standard Time and must be at least 30 minutes ahead.</p></div>
          <label>Pickup date and time<input min={minimumSchedule()} name="scheduledAt" required type="datetime-local" /></label>
          <label>Vehicle type<select defaultValue="sedan" name="vehicleType"><option value="motorcycle">Motorcycle</option><option value="sedan">Sedan</option><option value="suv">SUV</option><option value="van">Van</option></select></label>
          <label>Passenger notes <span className="label-optional">Optional</span><textarea maxLength={500} name="passengerNotes" placeholder="Flight number, luggage, accessibility, or pickup instructions" rows={4} /></label>
        </section>
        <aside className="fare-notice"><strong>Trusted fare estimate</strong><p>The browser does not submit a fare. HatidOne calculates distance, duration, and the placeholder estimate on the server and stores that result with your request.</p></aside>
        <SubmitButton pendingLabel="Calculating and requesting…">Calculate fare and request ride</SubmitButton>
      </form>
    </div>
  );
}
