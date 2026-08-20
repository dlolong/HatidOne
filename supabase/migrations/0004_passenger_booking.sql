alter table public.ride_requests
  add column client_request_id uuid;

create unique index ride_requests_passenger_request_key
  on public.ride_requests(passenger_id, client_request_id)
  where client_request_id is not null;

alter table public.ride_requests
  add constraint ride_requests_estimated_distance_nonnegative check (estimated_distance_meters is null or estimated_distance_meters >= 0),
  add constraint ride_requests_estimated_duration_nonnegative check (estimated_duration_seconds is null or estimated_duration_seconds >= 0),
  add constraint ride_requests_estimated_fare_nonnegative check (estimated_fare is null or estimated_fare >= 0),
  add constraint ride_requests_notes_length check (passenger_notes is null or length(passenger_notes) <= 500),
  add constraint scheduled_rides_have_schedule_and_estimate check (
    service_type <> 'scheduled' or (
      scheduled_at is not null
      and estimated_distance_meters is not null
      and estimated_duration_seconds is not null
      and estimated_fare is not null
    )
  ) not valid;

create table public.ride_request_events (
  id bigint generated always as identity primary key,
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created', 'status_changed', 'passenger_cancelled')),
  from_status public.ride_status,
  to_status public.ride_status not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create index ride_request_events_ride_idx
  on public.ride_request_events(ride_request_id, created_at, id);

alter table public.ride_request_events enable row level security;

create policy "passengers_read_own_ride_events"
on public.ride_request_events for select to authenticated
using (
  exists (
    select 1 from public.ride_requests
    where ride_requests.id = ride_request_events.ride_request_id
      and ride_requests.passenger_id = auth.uid()
  )
);

-- Passengers read their own requests through the 0001 policy. Direct writes are
-- removed so fare, ownership, status, and coordinates are set by trusted RPCs.
revoke all on table public.ride_requests from anon, authenticated;
grant select on table public.ride_requests to authenticated;
revoke all on table public.ride_request_events from anon, authenticated;
grant select on table public.ride_request_events to authenticated;

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
immutable
set search_path = ''
as $$
declare
  calculated_distance integer;
  base_fare numeric;
  per_km_fare numeric;
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

  return query select
    calculated_distance,
    greatest(900, ceil(calculated_distance / 8.33)::integer + 600),
    round(base_fare + (calculated_distance::numeric / 1000) * per_km_fare, 2);
end;
$$;

revoke all on function public.placeholder_scheduled_fare(double precision, double precision, double precision, double precision, text) from public;
grant execute on function public.placeholder_scheduled_fare(double precision, double precision, double precision, double precision, text) to authenticated;

create or replace function public.create_scheduled_ride_request(
  p_client_request_id uuid,
  p_pickup_address text,
  p_pickup_lat double precision,
  p_pickup_lng double precision,
  p_dropoff_address text,
  p_dropoff_lat double precision,
  p_dropoff_lng double precision,
  p_scheduled_at timestamptz,
  p_vehicle_type text,
  p_passenger_notes text default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  existing_id uuid;
  created_id uuid;
  quote record;
begin
  if not public.current_user_has_role('passenger') then raise exception 'passenger role required'; end if;
  if p_client_request_id is null then raise exception 'request id required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':' || p_client_request_id::text, 0)
  );
  select id into existing_id from public.ride_requests
  where passenger_id = auth.uid() and client_request_id = p_client_request_id;
  if existing_id is not null then return existing_id; end if;

  if nullif(trim(p_pickup_address), '') is null or length(trim(p_pickup_address)) > 240 then
    raise exception 'invalid pickup address';
  end if;
  if nullif(trim(p_dropoff_address), '') is null or length(trim(p_dropoff_address)) > 240 then
    raise exception 'invalid dropoff address';
  end if;
  if p_scheduled_at is null or p_scheduled_at < now() + interval '30 minutes' or p_scheduled_at > now() + interval '180 days' then
    raise exception 'invalid schedule';
  end if;
  if p_passenger_notes is not null and length(trim(p_passenger_notes)) > 500 then
    raise exception 'notes too long';
  end if;

  select * into quote from public.placeholder_scheduled_fare(
    p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng, p_vehicle_type
  );

  insert into public.ride_requests (
    passenger_id, client_request_id, pickup_address, pickup_location,
    dropoff_address, dropoff_location, service_type, vehicle_type,
    scheduled_at, estimated_distance_meters, estimated_duration_seconds,
    estimated_fare, passenger_notes, status
  ) values (
    auth.uid(), p_client_request_id, trim(p_pickup_address),
    public.st_setsrid(public.st_makepoint(p_pickup_lng, p_pickup_lat), 4326)::public.geography,
    trim(p_dropoff_address),
    public.st_setsrid(public.st_makepoint(p_dropoff_lng, p_dropoff_lat), 4326)::public.geography,
    'scheduled', p_vehicle_type, p_scheduled_at, quote.distance_meters,
    quote.duration_seconds, quote.estimated_fare, nullif(trim(p_passenger_notes), ''), 'requested'
  ) returning id into created_id;

  insert into public.ride_request_events (
    ride_request_id, actor_user_id, event_type, from_status, to_status, metadata
  ) values (
    created_id, auth.uid(), 'created', null, 'requested',
    jsonb_build_object('service_type', 'scheduled', 'fare_calculator', 'placeholder_v1')
  );
  return created_id;
end;
$$;

revoke all on function public.create_scheduled_ride_request(uuid, text, double precision, double precision, text, double precision, double precision, timestamptz, text, text) from public;
grant execute on function public.create_scheduled_ride_request(uuid, text, double precision, double precision, text, double precision, double precision, timestamptz, text, text) to authenticated;

create or replace function public.cancel_own_ride_request(p_ride_request_id uuid)
returns public.ride_status
language plpgsql
security definer set search_path = ''
as $$
declare
  current_status public.ride_status;
begin
  if not public.current_user_has_role('passenger') then raise exception 'passenger role required'; end if;
  select status into current_status from public.ride_requests
  where id = p_ride_request_id and passenger_id = auth.uid()
  for update;
  if current_status is null then raise exception 'ride request not found'; end if;
  if current_status = 'passenger_cancelled' then return current_status; end if;
  if current_status not in ('draft', 'requested', 'searching', 'offered', 'assigned', 'driver_en_route', 'driver_arrived') then
    raise exception 'ride request cannot be cancelled';
  end if;

  update public.ride_requests
  set status = 'passenger_cancelled', updated_at = now()
  where id = p_ride_request_id;
  insert into public.ride_request_events (
    ride_request_id, actor_user_id, event_type, from_status, to_status
  ) values (
    p_ride_request_id, auth.uid(), 'passenger_cancelled', current_status, 'passenger_cancelled'
  );
  return 'passenger_cancelled';
end;
$$;

revoke all on function public.cancel_own_ride_request(uuid) from public;
grant execute on function public.cancel_own_ride_request(uuid) to authenticated;

drop trigger if exists ride_requests_set_updated_at on public.ride_requests;
create trigger ride_requests_set_updated_at
  before update on public.ride_requests
  for each row execute procedure public.set_updated_at();
