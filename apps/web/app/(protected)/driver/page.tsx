import Link from 'next/link';
import { Dashboard, DashboardCard } from '@/components/dashboard';
import { SubmitButton } from '@/components/submit-button';
import { requireRole } from '@/lib/auth/session';
import { getDriverDispatchData } from '@/lib/dispatch/data';
import { acceptOffer, updateDriverAvailability } from './dispatch-actions';

type DriverDashboardProps = { searchParams: Promise<{ error?: string; message?: string }> };

function money(value: number | string | null): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount) : 'Fare pending';
}

export default async function DriverDashboard({ searchParams }: DriverDashboardProps) {
  await requireRole('driver');
  const [dispatch, alerts] = await Promise.all([getDriverDispatchData(), searchParams]);
  return (
    <Dashboard eyebrow="Driver workspace" title="Driver dashboard" description="Complete verification before becoming eligible for ride offers.">
      {alerts.error ? <p className="notice notice-error dashboard-wide" role="alert">{alerts.error}</p> : null}
      {alerts.message ? <p className="notice notice-success dashboard-wide" role="status">{alerts.message}</p> : null}
      <DashboardCard title="Onboarding"><p>Provide your personal, vehicle, and required document details.</p><Link className="button button-primary" href="/driver/onboarding">Open onboarding</Link></DashboardCard>
      <DashboardCard title="Availability">
        <p><span className="status-dot" /> {dispatch.driver?.online ? 'Online for offers' : 'Currently offline'}</p>
        <form action={updateDriverAvailability} className="compact-form">
          <div className="form-grid"><label>Current latitude<input inputMode="decimal" name="latitude" placeholder="14.5995" step="any" type="number" /></label><label>Current longitude<input inputMode="decimal" name="longitude" placeholder="120.9842" step="any" type="number" /></label></div>
          <div className="button-row"><button className="button button-primary" name="online" type="submit" value="true">Go online</button><button className="button button-ghost" name="online" type="submit" value="false">Go offline</button></div>
        </form>
      </DashboardCard>
      {dispatch.assignedRide ? <div className="dashboard-wide assignment-banner"><div><p className="eyebrow">Current assignment</p><h2>{dispatch.assignedRide.pickupAddress}</h2><p>to {dispatch.assignedRide.dropoffAddress}</p></div><span className="status-pill status-verified">{dispatch.assignedRide.status.replaceAll('_', ' ')}</span></div> : null}
      <div className="dashboard-wide">
        <div className="section-title-row"><h2>Active ride offers</h2><span>{dispatch.offers.length} available</span></div>
        {dispatch.offers.length === 0 ? <p className="large-empty compact-empty">No active offers. Verified drivers receive offers while online and within the configured pickup radius.</p> : <div className="offer-list">{dispatch.offers.map((offer) => (
          <article className="offer-card" key={offer.id}>
            <div className="offer-card-heading"><span className="status-pill status-under_review">Offer</span><span className="offer-earnings"><small>Expected gross earnings</small><strong>{money(offer.ride.estimatedFare)}</strong></span></div>
            <p><small>Pickup</small>{offer.ride.pickupAddress}</p><p><small>Drop-off</small>{offer.ride.dropoffAddress}</p>
            <dl><div><dt>Vehicle</dt><dd>{offer.ride.vehicleType}</dd></div><div><dt>Pickup distance</dt><dd>{offer.distanceMeters === null ? 'Nearby' : `${(offer.distanceMeters / 1000).toFixed(1)} km`}</dd></div><div><dt>Offer expires</dt><dd>{new Intl.DateTimeFormat('en-PH', { timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(offer.expiresAt))}</dd></div></dl>
            <p className="muted">No platform fee is configured in this MVP; the fare estimate is shown as gross expected earnings.</p>
            <form action={acceptOffer}><input name="offerId" type="hidden" value={offer.id} /><SubmitButton pendingLabel="Accepting…">Accept ride</SubmitButton></form>
          </article>
        ))}</div>}
      </div>
    </Dashboard>
  );
}
