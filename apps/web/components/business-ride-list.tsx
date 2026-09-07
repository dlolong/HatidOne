'use client';
import Link from 'next/link';
import { useState } from 'react';
import { StatusPill, EmptyState } from './ui';
export interface BusinessRideRow {
  id: string; pickup_address: string; dropoff_address: string; scheduled_at: string | null; status: string;
  passenger_count: number; estimated_fare: number | string | null; reference: string; href?: string;
}
export function BusinessRideList({ rides, initialStatus = '' }: { rides: BusinessRideRow[]; initialStatus?: string }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(0);
  const filtered = rides.filter(ride => (!status || ride.status === status) && `${ride.pickup_address} ${ride.dropoff_address} ${ride.reference}`.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages - 1);
  return <section className="dashboard-wide" id="rides"><div className="section-title-row"><h2>Transport schedule</h2><a className="button button-primary" href="#request">Request transport</a></div>
    <div className="record-tools"><label>Find a ride<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Pickup, destination or reference" /></label>
      <label>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="">All rides</option><option value="requested">Requested</option><option value="searching">Finding driver</option><option value="offered">Driver reviewing</option><option value="assigned">Driver assigned</option><option value="driver_en_route">Driver en route</option><option value="driver_arrived">Driver arrived</option><option value="trip_started">Trip started</option><option value="trip_completed">Completed</option><option value="passenger_cancelled">Cancelled by passenger</option></select></label></div>
    {filtered.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Route</th><th scope="col">Pickup time</th><th scope="col">Status</th><th scope="col">Details</th></tr></thead><tbody>{filtered.slice(current * 8, current * 8 + 8).map(ride => <tr key={ride.id}>
      <td data-label="Route"><div>{ride.href ? <Link href={ride.href}>{ride.pickup_address}</Link> : <strong>{ride.pickup_address}</strong>}<p className="muted">To {ride.dropoff_address}</p></div></td>
      <td data-label="Pickup time">{ride.scheduled_at ? new Date(ride.scheduled_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : 'Not scheduled'}</td>
      <td data-label="Status"><div><StatusPill status={ride.status} /></div></td>
      <td data-label="Details"><details><summary>Ride details</summary><p>{ride.passenger_count} passenger{ride.passenger_count === 1 ? '' : 's'}</p><p>Estimated fare: {ride.estimated_fare === null ? 'Pending' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(ride.estimated_fare))}</p><p>{ride.reference || 'No reference added'}</p><p className="record-reference">Booking reference: {ride.id}</p></details></td>
    </tr>)}</tbody></table></div> : <EmptyState title={rides.length ? 'No matching rides' : 'No transport scheduled yet'} action={<a className="button button-secondary" href="#request">Request transport</a>}>Try a different search or arrange a ride for your team or guests.</EmptyState>}
    {filtered.length > 8 && <nav className="pagination" aria-label="Transport schedule pages"><button className="button button-secondary" disabled={!current} onClick={() => setPage(current - 1)}>Previous</button><span aria-live="polite">Page {current + 1} of {pages}</span><button className="button button-secondary" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next</button></nav>}
  </section>;
}
