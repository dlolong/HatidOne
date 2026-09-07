-- Consume central pilot route and matching configuration without external providers.
create or replace function public.placeholder_scheduled_fare(
  p_pickup_lat double precision,
  p_pickup_lng double precision,
  p_dropoff_lat double precision,
  p_dropoff_lng double precision,
  p_vehicle_type text
)
returns table (
  distance_meters integer,
  duration_seconds integer,
  estimated_fare numeric(12,2)
)
language plpgsql
stable
set search_path = ''
as $$
declare
  calculated_distance integer;
  base_fare numeric;
  per_km_fare numeric;
  speed_kph integer;
begin
  if p_pickup_lat is null or p_pickup_lng is null or p_dropoff_lat is null or p_dropoff_lng is null
    or p_pickup_lat not between -90 and 90 or p_dropoff_lat not between -90 and 90
    or p_pickup_lng not between -180 and 180 or p_dropoff_lng not between -180 and 180 then
    raise exception 'invalid coordinates';
  end if;
  if p_vehicle_type is null or p_vehicle_type not in ('sedan', 'suv', 'van', 'motorcycle') then
    raise exception 'invalid vehicle type';
  end if;

  calculated_distance := round(public.st_distance(
    public.st_setsrid(public.st_makepoint(p_pickup_lng, p_pickup_lat), 4326)::public.geography,
    public.st_setsrid(public.st_makepoint(p_dropoff_lng, p_dropoff_lat), 4326)::public.geography
  ))::integer;

  select pricing.base_fare, pricing.per_km_fare
  into base_fare, per_km_fare
  from (values
    ('motorcycle', 80::numeric, 12::numeric),
    ('sedan', 120::numeric, 18::numeric),
    ('suv', 180::numeric, 24::numeric),
    ('van', 240::numeric, 30::numeric)
  ) as pricing(vehicle_type, base_fare, per_km_fare)
  where pricing.vehicle_type = p_vehicle_type;

  select mock_route_speed_kph into speed_kph from public.app_config where id;
  return query select
    calculated_distance,
    greatest(900, ceil(calculated_distance / (coalesce(speed_kph,30)::numeric / 3.6))::integer + 600),
    round(base_fare + (calculated_distance::numeric / 1000) * per_km_fare, 2);
end;
$$;

revoke all on function public.placeholder_scheduled_fare(double precision, double precision, double precision, double precision, text) from public;
grant execute on function public.placeholder_scheduled_fare(double precision, double precision, double precision, double precision, text) to authenticated;


create function private.valid_matching_weights(p_weights jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(p_weights)='object' and not exists(select 1 from jsonb_each(p_weights) entry
 where not (case when jsonb_typeof(entry.value)='number' then entry.value::text::numeric between 0 and 1000 else false end));
$$;
revoke all on function private.valid_matching_weights(jsonb) from public,anon,authenticated;
alter table public.app_config add constraint app_config_matching_weights_valid check(private.valid_matching_weights(matching_weights));

create function public.driver_matching_score(p_driver_id uuid,p_ride_id uuid,p_radius_meters integer) returns numeric
language plpgsql stable security definer set search_path='' as $$
declare d public.driver_profiles%rowtype; r public.ride_requests%rowtype; pref public.driver_preferences%rowtype;
 weights jsonb; pickup_distance integer; completion_count numeric; cancellation_count numeric; reliability numeric; idle_minutes numeric;
 home boolean:=false; is_return_trip boolean:=false; area boolean:=false; service boolean:=true;
begin
 select * into d from public.driver_profiles where id=p_driver_id;
 select * into r from public.ride_requests where id=p_ride_id;
 select * into pref from public.driver_preferences where driver_id=p_driver_id;
 select matching_weights into weights from public.app_config where id;
 pickup_distance:=public.driver_effective_pickup_distance(p_driver_id,p_ride_id);
 if d.id is null or r.id is null or pickup_distance is null or p_radius_meters is null or p_radius_meters<=0 then return 0; end if;
 if pref.driver_id is not null then
  service:=r.service_type=any(pref.service_types);
  area:=exists(select 1 from unnest(pref.preferred_areas) location where r.pickup_address ilike '%'||location||'%') or exists(select 1 from unnest(pref.destination_areas) location where r.dropoff_address ilike '%'||location||'%');
  home:=pref.going_home_enabled and coalesce(r.scheduled_at,r.created_at)>=pref.going_home_departure
   and public.st_distance(r.dropoff_location,public.st_setsrid(public.st_makepoint(pref.home_longitude,pref.home_latitude),4326)::public.geography)
      <public.st_distance(r.pickup_location,public.st_setsrid(public.st_makepoint(pref.home_longitude,pref.home_latitude),4326)::public.geography);
 end if;
 is_return_trip:=exists(select 1 from public.ride_assignments a join public.ride_requests outbound on outbound.id=a.ride_request_id
 where a.driver_id=d.id and outbound.id<>r.id and outbound.status in ('assigned','driver_en_route','driver_arrived','trip_started')
 and coalesce(outbound.scheduled_at,outbound.created_at)+make_interval(secs=>coalesce(outbound.estimated_duration_seconds,3600))+interval '30 minutes'<=r.scheduled_at
 and r.scheduled_at<=coalesce(outbound.scheduled_at,outbound.created_at)+make_interval(secs=>coalesce(outbound.estimated_duration_seconds,3600))+interval '8 hours'
 and public.st_dwithin(outbound.dropoff_location,r.pickup_location,p_radius_meters)
 and public.st_distance(r.dropoff_location,outbound.pickup_location)<public.st_distance(r.pickup_location,outbound.pickup_location));
 select count(*) filter(where history.status='trip_completed'),count(*) filter(where history.status='driver_cancelled') into completion_count,cancellation_count
 from public.ride_assignments a join public.ride_requests history on history.id=a.ride_request_id where a.driver_id=d.id;
 reliability:=case when completion_count+cancellation_count>=10 then completion_count/(completion_count+cancellation_count) else 0.5 end;
 select least(120,greatest(0,extract(epoch from now()-coalesce(max(t.completed_at),d.created_at))/60)) into idle_minutes from public.trips t where t.driver_id=d.id;
 return round(
  greatest(0,1-pickup_distance::numeric/p_radius_meters)*coalesce((weights->>'distance')::numeric,30)
  +(case when service then 1 else 0 end)*coalesce((weights->>'preferences')::numeric,20)/2
  +(case when area then 1 else 0 end)*coalesce((weights->>'preferences')::numeric,20)/2
  +reliability*coalesce((weights->>'reliability')::numeric,10)
  +(case when home then 1 else 0 end)*coalesce((weights->>'going_home')::numeric,20)
  +(case when is_return_trip then 1 else 0 end)*coalesce((weights->>'return_trip')::numeric,15)
  +(idle_minutes/120)*coalesce((weights->>'idle')::numeric,5),2);
end; $$;
revoke all on function public.driver_matching_score(uuid,uuid,integer) from public,anon,authenticated;

create or replace function public.find_eligible_drivers(p_ride_request_id uuid,p_radius_meters integer default null,p_limit integer default 20)
returns table(driver_id uuid,vehicle_id uuid,driver_user_id uuid,distance_meters integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.current_user_can_dispatch_ride(p_ride_request_id) then raise exception 'operations role required'; end if;
 p_radius_meters:=coalesce(p_radius_meters,(select default_matching_radius_km*1000 from public.app_config where id));
 if p_radius_meters is null or p_radius_meters not between 1000 and 100000 or p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid search range'; end if;
 return query select c.driver_id,c.vehicle_id,c.driver_user_id,c.distance_meters from (
 select distinct on(d.id) d.id driver_id,v.id vehicle_id,d.user_id driver_user_id,
 public.driver_effective_pickup_distance(d.id,r.id) distance_meters,public.driver_matching_score(d.id,r.id,p_radius_meters) matching_score
 from public.ride_requests r join public.driver_profiles d on d.online join public.driver_vehicles dv on dv.driver_id=d.id and dv.active join public.vehicles v on v.id=dv.vehicle_id
 where r.id=p_ride_request_id and r.status in ('requested','searching','offered','assigned','driver_en_route','driver_arrived')
 and public.driver_can_take_ride(d.id,v.id,r.id) and d.current_location is not null and public.driver_effective_pickup_distance(d.id,r.id)<=p_radius_meters
 and (public.current_user_is_operations() or exists(select 1 from public.fleets f where f.id=v.fleet_id and f.owner_user_id=auth.uid()))
 order by d.id,dv.is_primary desc,v.id) c order by c.matching_score desc,c.distance_meters,c.driver_id limit p_limit;
end; $$;
revoke all on function public.find_eligible_drivers(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.find_eligible_drivers(uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';

-- Serialize onboarding metadata mutations with verification and assignment eligibility.
create or replace function public.save_driver_vehicle(
  p_vehicle_type text,
  p_brand text,
  p_model text,
  p_year integer,
  p_color text,
  p_plate_number text,
  p_capacity integer,
  p_vehicle_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  current_driver_id uuid;
  result_id uuid;
begin
  if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
  select id into current_driver_id from public.driver_profiles where user_id = auth.uid() for update;
  if current_driver_id is null then raise exception 'driver profile required'; end if;
  if exists (
    select 1 from public.driver_profiles
    where id = current_driver_id and verification_status not in ('pending', 'rejected')
  ) then raise exception 'onboarding is locked'; end if;
  if p_vehicle_type is null or p_vehicle_type not in ('sedan', 'suv', 'van', 'motorcycle') then raise exception 'invalid vehicle type'; end if;
  if nullif(trim(p_brand), '') is null or nullif(trim(p_model), '') is null then raise exception 'brand and model required'; end if;
  if p_year is null or p_year < 1990 or p_year > extract(year from now())::integer + 1 then raise exception 'invalid year'; end if;
  if nullif(trim(p_color), '') is null or nullif(trim(p_plate_number), '') is null then raise exception 'color and plate required'; end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > 30 then raise exception 'invalid capacity'; end if;

  if p_vehicle_id is null then
    update public.driver_vehicles set is_primary = false where driver_id = current_driver_id and is_primary;
    insert into public.vehicles (owner_user_id, vehicle_type, brand, model, year, color, plate_number, capacity)
    values (auth.uid(), p_vehicle_type, trim(p_brand), trim(p_model), p_year, trim(p_color), upper(trim(p_plate_number)), p_capacity)
    returning id into result_id;
    insert into public.driver_vehicles (driver_id, vehicle_id, is_primary, active)
    values (current_driver_id, result_id, true, true);
  else
    update public.vehicles
    set vehicle_type = p_vehicle_type, brand = trim(p_brand), model = trim(p_model), year = p_year,
        color = trim(p_color), plate_number = upper(trim(p_plate_number)), capacity = p_capacity
    where id = p_vehicle_id and owner_user_id = auth.uid()
    returning id into result_id;
    if result_id is null then raise exception 'vehicle not found'; end if;
  end if;
  return result_id;
end;
$$;

revoke all on function public.save_driver_vehicle(text, text, text, integer, text, text, integer, uuid) from public;
grant execute on function public.save_driver_vehicle(text, text, text, integer, text, text, integer, uuid) to authenticated;

create or replace function public.record_driver_document(
  p_document_type text,
  p_storage_path text,
  p_expires_on date
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  current_driver_id uuid;
  result_id uuid;
begin
  if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
  if p_document_type not in ('drivers_license', 'professional_license', 'nbi_clearance', 'medical_certificate') then
    raise exception 'invalid document type';
  end if;
  if split_part(p_storage_path, '/', 1) <> auth.uid()::text then raise exception 'invalid storage path'; end if;
  select id into current_driver_id from public.driver_profiles where user_id = auth.uid() for update;
  if current_driver_id is null then raise exception 'driver profile required'; end if;
  if exists (
    select 1 from public.driver_profiles
    where id = current_driver_id and verification_status not in ('pending', 'rejected')
  ) then raise exception 'onboarding is locked'; end if;

  insert into public.driver_documents (driver_id, document_type, storage_path, expires_on)
  values (current_driver_id, p_document_type, p_storage_path, p_expires_on)
  on conflict (driver_id, document_type) do update
  set storage_path = excluded.storage_path,
      expires_on = excluded.expires_on,
      verification_status = 'pending',
      reviewed_by = null,
      reviewed_at = null,
      rejection_reason = null
  returning id into result_id;
  return result_id;
end;
$$;

revoke all on function public.record_driver_document(text, text, date) from public;
grant execute on function public.record_driver_document(text, text, date) to authenticated;

create or replace function public.record_vehicle_document(
  p_vehicle_id uuid,
  p_document_type text,
  p_storage_path text,
  p_expires_on date
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  result_id uuid;
begin
  if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
  perform 1 from public.driver_profiles where user_id=auth.uid() for update;
  if not found then raise exception 'driver profile required'; end if;
  if p_document_type not in ('registration', 'insurance', 'franchise', 'inspection_certificate') then
    raise exception 'invalid document type';
  end if;
  if split_part(p_storage_path, '/', 1) <> auth.uid()::text then raise exception 'invalid storage path'; end if;
  if not exists (select 1 from public.vehicles where id = p_vehicle_id and owner_user_id = auth.uid()) then
    raise exception 'vehicle not found';
  end if;
  if exists (
    select 1 from public.driver_profiles where user_id = auth.uid()
      and verification_status not in ('pending', 'rejected')
  ) then raise exception 'onboarding is locked'; end if;

  insert into public.vehicle_documents (vehicle_id, document_type, storage_path, expires_on)
  values (p_vehicle_id, p_document_type, p_storage_path, p_expires_on)
  on conflict (vehicle_id, document_type) do update
  set storage_path = excluded.storage_path,
      expires_on = excluded.expires_on,
      verification_status = 'pending',
      reviewed_by = null,
      reviewed_at = null,
      rejection_reason = null
  returning id into result_id;
  return result_id;
end;
$$;

revoke all on function public.record_vehicle_document(uuid, text, text, date) from public;
grant execute on function public.record_vehicle_document(uuid, text, text, date) to authenticated;

notify pgrst, 'reload schema';

-- Vehicle metadata must use the locking RPC too; earlier column grants allowed a review race.
revoke insert,update,delete on public.vehicles from anon,authenticated;
revoke insert(owner_user_id,vehicle_type,brand,model,year,color,plate_number,capacity),update(vehicle_type,brand,model,year,color,plate_number,capacity) on public.vehicles from anon,authenticated;
notify pgrst,'reload schema';
