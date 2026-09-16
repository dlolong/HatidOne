import Link from 'next/link';
import { dateTime } from '@/lib/operations/data';
import { SubmitButton } from '@/components/submit-button';
import { getDispatchQueue, getEligibleDriversForRide } from '@/lib/dispatch/data';
import { createOffers, expireOffers, manualAssign } from './actions';

type DispatchPageProps = {
  searchParams: Promise<{ ride?: string; radius?: string; error?: string; message?: string }>;
};

function fare(value: number | string | null): string {
  if (value === null) return 'Pending quote';
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount) : 'Pending';
}

export default async function DispatchPage({ searchParams }: DispatchPageProps) {
  const params = await searchParams;
  const queue = await getDispatchQueue();
  const radius = Math.min(100000, Math.max(1000, Number(params.radius) || 25000));
  const selectedRide = queue.find((ride) => ride.id === params.ride);
  const eligible = selectedRide && ['accepted','demo'].includes(selectedRide.quote_status) ? await getEligibleDriversForRide(selectedRide.id, radius) : [];

  return (
    <div className="dispatch-page">
      <Link className="back-link" href="/admin">← Admin dashboard</Link>
      <header className="list-heading"><div><p className="eyebrow">Operations</p><h1>Dispatch queue</h1><p>Manual dispatch. Review quote acceptance, driver eligibility and schedule coverage. The driver must reconfirm in app.</p></div><form action={expireOffers}><SubmitButton pendingLabel="Processing…">Expire old offers</SubmitButton></form></header>
      {params.error ? <p className="notice notice-error" role="alert">{params.error}</p> : null}
      {params.message ? <p className="notice notice-success" role="status">{params.message}</p> : null}
      {params.ride && !selectedRide && <p className="notice" role="status">The selected ride is no longer in this dispatch queue. It may have been assigned or cancelled. Review the operations workspace for its current status.</p>}
      {queue.length === 0 ? <section className="large-empty"><h2>No rides awaiting dispatch</h2><p>Requested and searching rides will appear here.</p></section> : <div className="dispatch-grid">
        <section><h2>Open rides</h2><div className="dispatch-queue">{queue.map((ride) => <article className={`dispatch-ride ${selectedRide?.id === ride.id ? 'dispatch-ride-selected' : ''}`} key={ride.id}><div><span className="status-pill">{ride.status}</span><strong>{fare(ride.estimated_fare)}</strong></div><h3>{ride.pickup_address}</h3><p>to {ride.dropoff_address}</p><p><strong>Pickup:</strong> {ride.scheduled_at ? dateTime(ride.scheduled_at) : 'No schedule recorded'}</p><small>{ride.vehicle_type} · quote {ride.quote_status.replaceAll('_', ' ')}</small><div className="button-row"><Link className="button button-secondary" href={`/admin/dispatch?ride=${ride.id}&radius=${radius}`} aria-current={selectedRide?.id === ride.id ? 'true' : undefined}>Find drivers</Link><form action={createOffers}><input name="rideId" type="hidden" value={ride.id} /><input name="radiusMeters" type="hidden" value={radius} /><SubmitButton pendingLabel="Creating offers…" disabled={!['accepted','demo'].includes(ride.quote_status)}>Create offers</SubmitButton></form>{ride.quote_status === 'pending_review' && <Link href="/admin/operations#overview">Review quote →</Link>}</div></article>)}</div></section>
        <section><div className="section-title-row"><h2>Eligible drivers</h2>{selectedRide ? <span>{eligible.length} found</span> : null}</div>{!selectedRide ? <p className="large-empty compact-empty">Select a ride to calculate eligible drivers.</p> : <><form className="radius-form" method="get"><input name="ride" type="hidden" value={selectedRide.id} /><label>Search radius (meters)<input defaultValue={radius} max={100000} min={1000} name="radius" type="number" /></label><button className="button button-secondary" type="submit">Update radius</button></form>{eligible.length === 0 ? <p className="large-empty compact-empty">No eligible driver available, or the quote still needs passenger acceptance. Review Needs Attention and driver availability.</p> : <div className="eligible-list">{eligible.map((driver) => <article className="eligible-card" key={driver.driverId}><div><strong>Driver {driver.driverId.slice(0, 8)}</strong><span>{driver.distanceMeters === null ? 'Distance unverified · operator scheduling review required' : `${(driver.distanceMeters / 1000).toFixed(1)} km away`}</span></div><small>Vehicle {driver.vehicleId.slice(0, 8)}</small><form action={manualAssign}><input name="rideId" type="hidden" value={selectedRide.id} /><input name="driverId" type="hidden" value={driver.driverId} /><input name="vehicleId" type="hidden" value={driver.vehicleId} /><input name="radiusMeters" type="hidden" value={radius} /><input name="quoteVersion" type="hidden" value={selectedRide.quote_version}/><label>Assignment reason and scheduling review<input name="reason" minLength={5} maxLength={2000} required/></label><SubmitButton pendingLabel="Assigning…">Assign driver</SubmitButton></form></article>)}</div>}</>}</section>
      </div>}
    </div>
  );
}
