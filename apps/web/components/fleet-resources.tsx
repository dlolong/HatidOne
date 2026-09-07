import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from './submit-button';
import { dispatchFleetRide, linkFleetVehicle } from '@/app/(protected)/organizations/actions';
type FleetVehicle={id:string;plate_number:string;vehicle_type:string;capacity:number;verified:boolean;active:boolean};
type FleetDriver={id:string;name:string;verification_status:string;online:boolean};
export async function FleetResources({ organizationId, admin }: {organizationId:string;admin:boolean}) {
  const client=await createClient();const {data,error}=await client.rpc('get_fleet_resources',{p_organization_id:organizationId});
  if(error)throw new Error('Fleet resources could not be loaded.');
  const resources=data as {vehicles:FleetVehicle[];drivers:FleetDriver[]};
  return <section className="dashboard-card dashboard-wide" id="fleet"><h2>Fleet drivers and vehicles</h2><p>{resources.drivers.filter(driver=>driver.online).length} available drivers · {resources.vehicles.filter(vehicle=>vehicle.active&&vehicle.verified).length} verified active vehicles</p><div className="table-scroll"><table><thead><tr><th>Driver</th><th>Verification</th><th>Availability</th></tr></thead><tbody>{resources.drivers.map(driver=><tr key={driver.id}><td>{driver.name}<small>{driver.id}</small></td><td>{driver.verification_status}</td><td>{driver.online?'Available':'Offline'}</td></tr>)}</tbody></table><table><thead><tr><th>Plate</th><th>Vehicle</th><th>Capacity</th><th>Status</th></tr></thead><tbody>{resources.vehicles.map(vehicle=><tr key={vehicle.id}><td>{vehicle.plate_number}</td><td>{vehicle.vehicle_type}</td><td>{vehicle.capacity}</td><td>{vehicle.verified?'Verified':'Review required'} · {vehicle.active?'Active':'Inactive'}</td></tr>)}</tbody></table></div>
    {!resources.vehicles.length&&<p>No vehicles linked. Operations links verified vehicles after reviewing fleet ownership.</p>}
    <details><summary>Manually dispatch an eligible fleet driver</summary><form action={dispatchFleetRide} className="compact-form"><input name="organization_id" type="hidden" value={organizationId} /><label>Unassigned booking ID<input name="ride_id" required /></label><label>Driver<select name="driver_id" required>{resources.drivers.map(driver=><option key={driver.id} value={driver.id}>{driver.name} · {driver.verification_status}</option>)}</select></label><label>Vehicle<select name="vehicle_id" required>{resources.vehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.plate_number}</option>)}</select></label><SubmitButton pendingLabel="Assigning…">Assign driver</SubmitButton></form></details>
    {admin&&<details><summary>Link approved vehicle to fleet</summary><form action={linkFleetVehicle} className="compact-form"><input name="organization_id" type="hidden" value={organizationId} /><label>Existing vehicle ID<input name="vehicle_id" required /></label><SubmitButton pendingLabel="Linking…">Link vehicle</SubmitButton></form></details>}
  </section>;
}
