alter table public.ride_offers
  add column vehicle_id uuid references public.vehicles(id),
  add column distance_meters integer check (distance_meters is null or distance_meters >= 0);

create index ride_offers_driver_status_idx on public.ride_offers(driver_id, status, expires_at);
create index ride_offers_ride_status_idx on public.ride_offers(ride_request_id, status, expires_at);

create table public.dispatch_events (
  id bigint generated always as identity primary key,
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('offers_created', 'offers_expired', 'offer_accepted', 'manual_assignment', 'passenger_cancelled')),
  from_status public.ride_status,
  to_status public.ride_status not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index dispatch_events_ride_idx on public.dispatch_events(ride_request_id, created_at, id);
alter table public.dispatch_events enable row level security;

create or replace function public.current_user_is_operations()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin'::public.user_role, 'support'::public.user_role)
      and account_status = 'active'::public.account_status
  );
$$;

revoke all on function public.current_user_is_operations() from public;
grant execute on function public.current_user_is_operations() to authenticated;

create or replace function public.current_user_can_read_ride(target_ride_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select public.current_user_is_operations()
    or exists (
      select 1 from public.ride_requests where id = target_ride_id and passenger_id = auth.uid()
    )
    or exists (
      select 1 from public.ride_offers ro
      join public.driver_profiles dp on dp.id = ro.driver_id
      where ro.ride_request_id = target_ride_id and dp.user_id = auth.uid()
        and ro.status in ('pending', 'accepted')
    )
    or exists (
      select 1 from public.ride_assignments ra
      join public.driver_profiles dp on dp.id = ra.driver_id
      where ra.ride_request_id = target_ride_id and dp.user_id = auth.uid()
    );
$$;

revoke all on function public.current_user_can_read_ride(uuid) from public;
grant execute on function public.current_user_can_read_ride(uuid) to authenticated;

create or replace function public.set_driver_availability(
  p_online boolean,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  current_driver public.driver_profiles%rowtype;
begin
  if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
  select * into current_driver from public.driver_profiles where user_id = auth.uid() for update;
  if current_driver.id is null or current_driver.verification_status <> 'verified' then
    raise exception 'verified driver required';
  end if;
  if p_online and (
    p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
  ) then raise exception 'valid location required'; end if;

  update public.driver_profiles
  set online = p_online,
      current_location = case when p_online then
        public.st_setsrid(public.st_makepoint(p_longitude, p_latitude), 4326)::public.geography
      else current_location end
  where id = current_driver.id;
end;
$$;

revoke all on function public.set_driver_availability(boolean, double precision, double precision) from public;
grant execute on function public.set_driver_availability(boolean, double precision, double precision) to authenticated;

create or replace function public.find_eligible_drivers(
  p_ride_request_id uuid,
  p_radius_meters integer default 25000,
  p_limit integer default 20
)
returns table (
  driver_id uuid,
  vehicle_id uuid,
  driver_user_id uuid,
  distance_meters integer
)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not (public.current_user_is_operations() or public.current_user_has_role('fleet_admin')) then
    raise exception 'operations role required';
  end if;
  if p_radius_meters < 1000 or p_radius_meters > 100000 then raise exception 'invalid radius'; end if;
  if p_limit < 1 or p_limit > 100 then raise exception 'invalid limit'; end if;

  return query
  select candidates.driver_id, candidates.vehicle_id, candidates.driver_user_id, candidates.distance_meters
  from (
    select distinct on (dp.id)
      dp.id as driver_id,
      v.id as vehicle_id,
      dp.user_id as driver_user_id,
      round(public.st_distance(dp.current_location, rr.pickup_location))::integer as distance_meters
    from public.ride_requests rr
    join public.driver_profiles dp on dp.verification_status = 'verified' and dp.online
    join public.profiles profile on profile.id = dp.user_id and profile.account_status = 'active'
    join public.driver_vehicles dv on dv.driver_id = dp.id and dv.active
    join public.vehicles v on v.id = dv.vehicle_id
      and v.active and v.verified and v.vehicle_type = rr.vehicle_type
    where rr.id = p_ride_request_id
      and rr.status in ('requested', 'searching', 'offered')
      and dp.current_location is not null
      and public.st_dwithin(dp.current_location, rr.pickup_location, p_radius_meters)
      and (
        public.current_user_is_operations()
        or exists (
          select 1 from public.fleets f
          where f.id = v.fleet_id and f.owner_user_id = auth.uid()
        )
      )
    order by dp.id, dv.is_primary desc, public.st_distance(dp.current_location, rr.pickup_location), v.id
  ) candidates
  order by candidates.distance_meters, candidates.driver_id
  limit p_limit;
end;
$$;

revoke all on function public.find_eligible_drivers(uuid, integer, integer) from public;
grant execute on function public.find_eligible_drivers(uuid, integer, integer) to authenticated;

create or replace function public.create_ride_offers(
  p_ride_request_id uuid,
  p_radius_meters integer default 25000,
  p_offer_seconds integer default 120,
  p_limit integer default 20
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  current_status public.ride_status;
  offered_count integer;
begin
  if not (public.current_user_is_operations() or public.current_user_has_role('fleet_admin')) then
    raise exception 'operations role required';
  end if;
  if p_offer_seconds < 30 or p_offer_seconds > 3600 then raise exception 'invalid offer duration'; end if;

  select status into current_status from public.ride_requests
  where id = p_ride_request_id for update;
  if current_status is null then raise exception 'ride request not found'; end if;
  if current_status not in ('requested', 'searching', 'offered') then raise exception 'ride cannot be offered'; end if;

  insert into public.ride_offers (
    ride_request_id, driver_id, vehicle_id, offered_at, expires_at, status, distance_meters
  )
  select p_ride_request_id, eligible.driver_id, eligible.vehicle_id, now(),
    now() + make_interval(secs => p_offer_seconds), 'pending', eligible.distance_meters
  from public.find_eligible_drivers(p_ride_request_id, p_radius_meters, p_limit) eligible
  on conflict (ride_request_id, driver_id) do update
  set vehicle_id = excluded.vehicle_id,
      offered_at = excluded.offered_at,
      expires_at = excluded.expires_at,
      status = 'pending',
      distance_meters = excluded.distance_meters
  where ride_offers.status in ('declined', 'expired', 'cancelled');

  select count(*)::integer into offered_count from public.ride_offers
  where ride_request_id = p_ride_request_id and status = 'pending' and expires_at > now();

  update public.ride_requests
  set status = case when offered_count > 0 then 'offered'::public.ride_status else 'searching'::public.ride_status end
  where id = p_ride_request_id;

  insert into public.dispatch_events (ride_request_id, actor_user_id, event_type, from_status, to_status, metadata)
  values (
    p_ride_request_id, auth.uid(), 'offers_created', current_status,
    case when offered_count > 0 then 'offered'::public.ride_status else 'searching'::public.ride_status end,
    jsonb_build_object('offer_count', offered_count, 'radius_meters', p_radius_meters)
  );
  return offered_count;
end;
$$;

revoke all on function public.create_ride_offers(uuid, integer, integer, integer) from public;
grant execute on function public.create_ride_offers(uuid, integer, integer, integer) to authenticated;

create or replace function public.expire_ride_offers()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  expired_count integer;
  ride_expired_count integer;
  affected_ride uuid;
begin
  if not public.current_user_is_operations() then raise exception 'operations role required'; end if;
  expired_count := 0;
  for affected_ride in
    select distinct ride_request_id from public.ride_offers
    where status = 'pending' and expires_at <= now()
    order by ride_request_id
  loop
    perform 1 from public.ride_requests where id = affected_ride for update;
    update public.ride_offers set status = 'expired'
    where ride_request_id = affected_ride and status = 'pending' and expires_at <= now();
    get diagnostics ride_expired_count = row_count;
    expired_count := expired_count + ride_expired_count;
    if not exists (
      select 1 from public.ride_offers
      where ride_request_id = affected_ride and status = 'pending' and expires_at > now()
    ) then
      update public.ride_requests set status = 'searching'
      where id = affected_ride and status = 'offered';
      if found then
        insert into public.dispatch_events (ride_request_id, actor_user_id, event_type, from_status, to_status)
        values (affected_ride, auth.uid(), 'offers_expired', 'offered', 'searching');
      end if;
    end if;
  end loop;
  return expired_count;
end;
$$;

revoke all on function public.expire_ride_offers() from public;
grant execute on function public.expire_ride_offers() to authenticated;

create or replace function public.accept_ride_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  current_driver_id uuid;
  target_ride_id uuid;
  target_vehicle_id uuid;
  current_ride_status public.ride_status;
  current_offer_status public.ride_offer_status;
  current_expiry timestamptz;
  assignment_id uuid;
begin
  if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
  select id into current_driver_id from public.driver_profiles
  where user_id = auth.uid() and verification_status = 'verified' and online;
  if current_driver_id is null then raise exception 'eligible driver required'; end if;

  select ride_request_id into target_ride_id from public.ride_offers
  where id = p_offer_id and driver_id = current_driver_id;
  if target_ride_id is null then raise exception 'offer not found'; end if;

  -- All assignment and cancellation paths lock the ride first.
  select status into current_ride_status from public.ride_requests
  where id = target_ride_id for update;
  select status, expires_at, vehicle_id into current_offer_status, current_expiry, target_vehicle_id
  from public.ride_offers where id = p_offer_id and driver_id = current_driver_id for update;

  if current_ride_status <> 'offered' then raise exception 'ride is no longer available'; end if;
  if current_offer_status <> 'pending' or current_expiry <= now() then raise exception 'offer expired'; end if;
  if not exists (
    select 1 from public.driver_vehicles dv
    join public.vehicles v on v.id = dv.vehicle_id
    join public.profiles p on p.id = auth.uid()
    join public.driver_profiles dp on dp.id = dv.driver_id
    join public.ride_requests rr on rr.id = target_ride_id
    where dv.driver_id = current_driver_id and dv.vehicle_id = target_vehicle_id and dv.active
      and v.active and v.verified and v.vehicle_type = rr.vehicle_type and p.account_status = 'active'
      and dp.verification_status = 'verified' and dp.online
  ) then raise exception 'driver is no longer eligible'; end if;

  insert into public.ride_assignments (
    ride_request_id, driver_id, vehicle_id, fleet_id, assignment_type
  )
  select target_ride_id, current_driver_id, target_vehicle_id, v.fleet_id, 'automatic'
  from public.vehicles v where v.id = target_vehicle_id
  returning id into assignment_id;

  update public.ride_offers set status = case when id = p_offer_id then 'accepted'::public.ride_offer_status else 'cancelled'::public.ride_offer_status end
  where ride_request_id = target_ride_id and status = 'pending';
  update public.ride_requests set status = 'assigned' where id = target_ride_id;
  insert into public.dispatch_events (ride_request_id, actor_user_id, event_type, from_status, to_status, metadata)
  values (target_ride_id, auth.uid(), 'offer_accepted', current_ride_status, 'assigned', jsonb_build_object('offer_id', p_offer_id, 'assignment_id', assignment_id));
  return assignment_id;
end;
$$;

revoke all on function public.accept_ride_offer(uuid) from public;
grant execute on function public.accept_ride_offer(uuid) to authenticated;

create or replace function public.manual_assign_ride(
  p_ride_request_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_radius_meters integer default 100000
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  current_status public.ride_status;
  assignment_id uuid;
  assignment_kind text;
begin
  if not (public.current_user_is_operations() or public.current_user_has_role('fleet_admin')) then
    raise exception 'operations role required';
  end if;
  if p_radius_meters < 1000 or p_radius_meters > 100000 then raise exception 'invalid radius'; end if;
  select status into current_status from public.ride_requests where id = p_ride_request_id for update;
  if current_status is null or current_status not in ('requested', 'searching', 'offered') then
    raise exception 'ride cannot be assigned';
  end if;
  if not exists (
    select 1 from public.find_eligible_drivers(p_ride_request_id, p_radius_meters, 100) eligible
    where eligible.driver_id = p_driver_id and eligible.vehicle_id = p_vehicle_id
  ) then raise exception 'driver is not eligible'; end if;

  assignment_kind := case when public.current_user_is_operations() then 'admin' else 'fleet' end;
  insert into public.ride_assignments (ride_request_id, driver_id, vehicle_id, fleet_id, assignment_type)
  select p_ride_request_id, p_driver_id, p_vehicle_id, v.fleet_id, assignment_kind
  from public.vehicles v where v.id = p_vehicle_id
  returning id into assignment_id;
  update public.ride_offers set status = 'cancelled'
  where ride_request_id = p_ride_request_id and status = 'pending';
  update public.ride_requests set status = 'assigned' where id = p_ride_request_id;
  insert into public.dispatch_events (ride_request_id, actor_user_id, event_type, from_status, to_status, metadata)
  values (p_ride_request_id, auth.uid(), 'manual_assignment', current_status, 'assigned', jsonb_build_object('assignment_id', assignment_id));
  return assignment_id;
end;
$$;

revoke all on function public.manual_assign_ride(uuid, uuid, uuid, integer) from public;
grant execute on function public.manual_assign_ride(uuid, uuid, uuid, integer) to authenticated;

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
  where id = p_ride_request_id and passenger_id = auth.uid() for update;
  if current_status is null then raise exception 'ride request not found'; end if;
  if current_status = 'passenger_cancelled' then return current_status; end if;
  if current_status not in ('draft', 'requested', 'searching', 'offered', 'assigned', 'driver_en_route', 'driver_arrived') then
    raise exception 'ride request cannot be cancelled';
  end if;
  update public.ride_requests set status = 'passenger_cancelled' where id = p_ride_request_id;
  update public.ride_offers set status = 'cancelled'
  where ride_request_id = p_ride_request_id and status = 'pending';
  insert into public.dispatch_events (ride_request_id, actor_user_id, event_type, from_status, to_status)
  values (p_ride_request_id, auth.uid(), 'passenger_cancelled', current_status, 'passenger_cancelled');
  return 'passenger_cancelled';
end;
$$;

revoke all on function public.cancel_own_ride_request(uuid) from public;
grant execute on function public.cancel_own_ride_request(uuid) to authenticated;

create policy "drivers_read_own_offers" on public.ride_offers for select to authenticated
using (exists (select 1 from public.driver_profiles where id = ride_offers.driver_id and user_id = auth.uid()));
create policy "operations_read_all_offers" on public.ride_offers for select to authenticated
using (public.current_user_is_operations());

create policy "participants_read_assignments" on public.ride_assignments for select to authenticated
using (public.current_user_can_read_ride(ride_request_id));

create policy "dispatch_participants_read_ride" on public.ride_requests for select to authenticated
using (public.current_user_can_read_ride(id));
create policy "operations_read_rides" on public.ride_requests for select to authenticated
using (public.current_user_is_operations());

create policy "participants_read_dispatch_events" on public.dispatch_events for select to authenticated
using (public.current_user_can_read_ride(ride_request_id));

revoke all on table public.ride_offers from anon, authenticated;
grant select on table public.ride_offers to authenticated;
revoke all on table public.ride_assignments from anon, authenticated;
grant select on table public.ride_assignments to authenticated;
revoke all on table public.dispatch_events from anon, authenticated;
grant select on table public.dispatch_events to authenticated;

revoke insert, update, delete on table public.ride_requests from anon, authenticated;
grant select on table public.ride_requests to authenticated;

drop trigger if exists ride_requests_set_updated_at on public.ride_requests;
create trigger ride_requests_set_updated_at
  before update on public.ride_requests
  for each row execute procedure public.set_updated_at();

notify pgrst, 'reload schema';
