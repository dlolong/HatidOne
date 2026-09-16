'use client';
import { useState } from 'react';
import { DEMO_LOCATIONS } from '@hatidone/core';
import { createBooking } from '@/app/(protected)/book/actions';
import { SubmitButton } from './submit-button';
import type { BookingIntent } from '@/lib/booking/partner-link';
type Point = { address: string; lat: string; lng: string };
function address(value?: string) { return DEMO_LOCATIONS.find(location => location.id === value)?.label ?? value ?? ''; }
export function BookingPlanner({ requestId, intent, rebook }: { requestId: string; intent: BookingIntent; rebook?: { pickup: Point; dropoff: Point } }) {
  const [vehicle, setVehicle] = useState('sedan');
  const scheduled = intent.scheduledAt && Number.isFinite(Date.parse(intent.scheduledAt)) ? new Date(Date.parse(intent.scheduledAt) + 8 * 3600_000).toISOString().slice(0, 16) : undefined;
  return <form action={createBooking} className="booking-form">
    <input name="requestId" type="hidden" value={requestId} />
    <input name="partnerId" type="hidden" value={intent.partnerId ?? ''} />
    <input name="externalReference" type="hidden" value={intent.externalReference ?? ''} />
    <div className="form-grid">
      <label>Pickup address and landmark<input name="pickupAddress" required maxLength={240} defaultValue={rebook?.pickup.address ?? address(intent.pickup)} autoComplete="street-address" /></label>
      <label>Destination address and landmark<input name="dropoffAddress" required maxLength={240} defaultValue={rebook?.dropoff.address ?? address(intent.destination)} /></label>
      <label>Route preference<select name="routePreference"><option value="fastest">Discuss fastest route</option><option value="avoid_tolls">Prefer avoiding tolls</option><option value="preferred_route">Discuss preferred route</option></select></label>
      <label>Pickup time (Asia/Manila)<input name="scheduledAt" required type="datetime-local" defaultValue={scheduled} /></label>
      <label>Service<select name="serviceType" defaultValue={intent.serviceType === 'transfer' ? 'transfer' : 'scheduled'}><option value="scheduled">Scheduled ride</option><option value="transfer">Airport / resort transfer</option></select></label>
      <label>Passengers<input name="passengerCount" type="number" min={1} max={vehicle === 'motorcycle' ? 1 : vehicle === 'sedan' ? 4 : vehicle === 'suv' ? 6 : 15} defaultValue={intent.guestCount ?? 1} required /></label>
      <label>Vehicle<select name="vehicleType" value={vehicle} onChange={event => setVehicle(event.target.value)}><option value="sedan">Sedan</option><option value="suv">SUV</option><option value="van">Van</option><option value="motorcycle">Motorcycle</option></select></label>
    </div>
    <label>Pickup notes (optional)<textarea name="passengerNotes" maxLength={500} placeholder="Flight number, luggage or pickup instructions" /></label>
    <aside className="fare-notice"><h2>Request a reviewed quote</h2><p>Operations must review your addresses, route, travel allowance and total fare. Location validation and arrival estimates are unavailable. You will accept the reviewed quote before driver assignment.</p></aside>
    <p>Schedule pickup 30 minutes to 180 days ahead. This request does not confirm a driver. Cash collection is recorded after the trip; no payment is taken here.</p>
    <SubmitButton pendingLabel="Requesting…">Request quote</SubmitButton>
  </form>;
}
