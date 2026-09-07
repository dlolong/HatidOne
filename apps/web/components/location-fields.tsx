'use client';
import { useState } from 'react';
import { DEMO_LOCATIONS } from '@hatidone/core';
export type LocationPoint = { address: string; lat: string; lng: string };
export function LocationFields({ label, names, value, onChange, currentLocation = false }: {
  label: string; names: { address: string; lat: string; lng: string }; value: LocationPoint; onChange: (point: LocationPoint) => void; currentLocation?: boolean;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  function useCurrentLocation() {
    setError('');
    if (!navigator.geolocation) { setError('Location is unavailable. Choose a service location or add coordinates.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      onChange({ ...value, lat: String(position.coords.latitude), lng: String(position.coords.longitude) }); setLocating(false);
    }, () => { setError('Allow location access, choose a service location or add coordinates.'); setLocating(false); }, { timeout: 12000 });
  }
  return <fieldset onInvalid={event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && [names.lat, names.lng].includes(input.name)) {
      event.preventDefault();
      setAdvanced(true);
      setError('Choose a service location or enter valid latitude and longitude.');
      requestAnimationFrame(() => input.focus());
    }
  }}><legend>{label}</legend><label>Service location<select value="" onChange={event => {
    const selected = DEMO_LOCATIONS.find(location => location.id === event.target.value);
    if (selected) { onChange({ address: selected.label, lat: String(selected.coordinates?.latitude ?? ''), lng: String(selected.coordinates?.longitude ?? '') }); setError(''); }
  }}><option value="">Choose a known pickup or destination</option>{DEMO_LOCATIONS.map(location => <option key={location.id} value={location.id}>{location.label}</option>)}</select></label>
    <label>Exact address<input name={names.address} value={value.address} onChange={event => onChange({ ...value, address: event.target.value })} required maxLength={240} placeholder="Building, street or pickup landmark" /></label>
    {currentLocation && <button className="button button-secondary" type="button" disabled={locating} onClick={useCurrentLocation}>{locating ? 'Finding your location…' : 'Use current location'}</button>}
    <details open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)}><summary>{value.lat && value.lng ? 'Location selected · edit coordinates' : 'Add coordinates for a custom address'}</summary>
      <p className="muted">Service locations are approximate. Add exact map coordinates when needed.</p>
      <div className="form-grid"><label>Latitude<input name={names.lat} required type="number" step="any" min={-90} max={90} value={value.lat} onChange={event => { setError(''); onChange({ ...value, lat: event.target.value }); }} /></label><label>Longitude<input name={names.lng} required type="number" step="any" min={-180} max={180} value={value.lng} onChange={event => { setError(''); onChange({ ...value, lng: event.target.value }); }} /></label></div>
    </details>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
  </fieldset>;
}
export function TransportLocations() {
  const [pickup, setPickup] = useState<LocationPoint>({ address: '', lat: '', lng: '' });
  const [destination, setDestination] = useState<LocationPoint>({ address: '', lat: '', lng: '' });
  return <div className="form-grid"><LocationFields label="Pickup" names={{ address: 'pickup_address', lat: 'pickup_lat', lng: 'pickup_lng' }} value={pickup} onChange={setPickup} currentLocation />
    <LocationFields label="Destination" names={{ address: 'dropoff_address', lat: 'dropoff_lat', lng: 'dropoff_lng' }} value={destination} onChange={setDestination} /></div>;
}
