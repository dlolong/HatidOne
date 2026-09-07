import { randomUUID } from 'node:crypto';
import { TransportLocations } from './location-fields';
import { SubmitButton } from './submit-button';
import { createTransport } from '@/app/(protected)/organizations/actions';
export function TransportForm({ organizationId, corporate }: { organizationId: string; corporate: boolean }) {
  return <form action={createTransport} className="compact-form"><input type="hidden" name="organization_id" value={organizationId} /><input type="hidden" name="client_request_id" value={randomUUID()} />
    <TransportLocations />
    <div className="form-grid"><label>Pickup time (Philippines)<input name="scheduled_at" type="datetime-local" required /></label><label>Passengers<input name="passenger_count" type="number" min={1} max={30} defaultValue={1} required /></label><label>Vehicle<select name="vehicle_type"><option value="sedan">Sedan</option><option value="suv">SUV</option><option value="van">Van</option><option value="motorcycle">Motorcycle</option></select></label><label>Service<select name="service_type"><option value="transfer">Airport / resort transfer</option><option value="scheduled">Scheduled ride</option><option value="local">Local ride</option></select></label><label>Route preference<select name="route_preference"><option value="fastest">Fastest</option><option value="avoid_tolls">Avoid tolls</option><option value="preferred_route">Discuss preferred route</option></select></label><label>Reservation / external reference<input name="external_reference" maxLength={120} /></label></div>
    {corporate && <><label>Authorized employee user ID (optional)<input name="passenger_id" placeholder="Leave empty to book for yourself" /></label><label>Ride purpose / cost center<input name="ride_purpose" maxLength={240} placeholder="Airport trip · Sales" /></label></>}
    <p className="muted">You’ll see a local fare estimate after submitting. Confirm tolls and pickup details with your driver. No online payment is taken.</p><SubmitButton pendingLabel="Requesting…">Request transport</SubmitButton>
  </form>;
}
