import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { getDispatchQueue, getEligibleDriversForRide } from '@/lib/dispatch/data';
import { createOffers, expireOffers, manualAssign } from './actions';

type DispatchPageProps = {
  searchParams: Promise<{ ride?: string; radius?: string; error?: string; message?: string }>;
};

function fare(value: number | string | null): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount) : 'Pending';
}

export default async function DispatchPage({ searchParams }: DispatchPageProps) {
  const params = await searchParams;
  const queue = await getDispatchQueue();
  const radius = Math.min(100000, Math.max(1000, Number(params.radius) || 25000));
  const selectedRide = queue.find((ride) => ride.id === params.ride);
  const eligible = selectedRide ? await getEligibleDriversForRide(selectedRide.id, radius) : [];

  return (
    <div className="dispatch-page">
      <Link className="back-link" href="/admin">← Admin dashboard</Link>
      <header className="list-heading"><div><p className="eyebrow">Operations</p><h1>Dispatch queue</h1><p>Eligibility is recalculated from verification, account, availability, vehicle, and PostGIS proximity data.</p></div><form action={expireOffers}><SubmitButton pendingLabel="Processing…">Expire old offers</SubmitButton></form></header>
      {params.error ? <p className="notice notice-error" role="alert">{params.error}</p> : null}
      {params.message ? <p className="notice notice-success" role="status">{params.message}</p> : null}
      {queue.length === 0 ? <section className="large-empty"><h2>No rides awaiting dispatch</h2><p>Requested and searching rides will appear here.</p></section> : <div className="dispatch-grid">
        <section><h2>Open rides</h2><div className="dispatch-queue">{queue.map((ride) => <article className={`dispatch-ride ${selectedRide?.id === ride.id ? 'dispatch-ride-selected' : ''}`} key={ride.id}><div><span className="status-pill">{ride.status}</span><strong>{fare(ride.estimated_fare)}</strong></div><h3>{ride.pickup_address}</h3><p>to {ride.dropoff_address}</p><small>{ride.vehicle_type}</small><div className="button-row"><Link className="button button-secondary" href={`/admin/dispatch?ride=${ride.id}&radius=${radius}`}>Find drivers</Link><form action={createOffers}><input name="rideId" type="hidden" value={ride.id} /><input name="radiusMeters" type="hidden" value={radius} /><button className="button button-primary" type="submit">Create offers</button></form></div></article>)}</div></section>
        <section><div className="section-title-row"><h2>Eligible drivers</h2>{selectedRide ? <span>{eligible.length} found</span> : null}</div>{!selectedRide ? <p className="large-empty compact-empty">Select a ride to calculate eligible drivers.</p> : <><form className="radius-form" method="get"><input name="ride" type="hidden" value={selectedRide.id} /><label>Search radius (meters)<input defaultValue={radius} max={100000} min={1000} name="radius" type="number" /></label><button className="button button-secondary" type="submit">Update radius</button></form>{eligible.length === 0 ? <p className="large-empty compact-empty">No verified, online driver with a compatible verified vehicle is within this radius.</p> : <div className="eligible-list">{eligible.map((driver) => <article className="eligible-card" key={driver.driverId}><div><strong>Driver {driver.driverId.slice(0, 8)}</strong><span>{(driver.distanceMeters / 1000).toFixed(1)} km away</span></div><small>Vehicle {driver.vehicleId.slice(0, 8)}</small><form action={manualAssign}><input name="rideId" type="hidden" value={selectedRide.id} /><input name="driverId" type="hidden" value={driver.driverId} /><input name="vehicleId" type="hidden" value={driver.vehicleId} /><input name="radiusMeters" type="hidden" value={radius} /><SubmitButton pendingLabel="Assigning…">Assign driver</SubmitButton></form></article>)}</div>}</>}</section>
      </div>}
    </div>
  );
}
