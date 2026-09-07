-- Product completion foundation. All privileged mutations are RPC-only.
create table public.app_config (
  id boolean primary key default true check (id),
  driver_commission_percent numeric(5,2) not null default 0 check (driver_commission_percent between 0 and 100),
  demo_mode boolean not null default false,
  confirmation_minutes integer not null default 60 check (confirmation_minutes between 5 and 1440),
  matching_weights jsonb not null default '{"distance":30,"reliability":15,"going_home":20,"return_trip":20,"idle":5,"preferences":10}' check(jsonb_typeof(matching_weights)='object'),
  updated_at timestamptz not null default now()
);
insert into public.app_config(id) values(true);
create table public.audit_events (
 id bigint generated always as identity primary key, actor_user_id uuid references public.profiles(id),
 action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object'),
 created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events(created_at desc);
create table public.organizations (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('fleet','partner','corporate')),
 name text not null check(length(trim(name)) between 2 and 160), owner_user_id uuid not null references public.profiles(id),
 partner_type text check(partner_type in ('resort','hotel','travel_agent','transport_operator','corporate','other')),
 external_reference text, fleet_id uuid unique references public.fleets(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index organizations_owner_idx on public.organizations(owner_user_id);
create table public.organization_members (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references public.profiles(id), member_role text not null check(member_role in ('owner','manager','rider')),
 status text not null default 'active' check(status in ('active','inactive')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,user_id)
);
create index organization_members_user_idx on public.organization_members(user_id,organization_id);
create table public.organization_locations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 label text not null check(length(trim(label)) between 1 and 100), address text not null check(length(trim(address)) between 1 and 240),
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 created_at timestamptz not null default now()
);
create index organization_locations_org_idx on public.organization_locations(organization_id);
create table public.subscription_plans (
 id text primary key, audience text not null check(audience in ('fleet','partner','corporate')), display_name text not null,
 features jsonb not null check(jsonb_typeof(features)='array'), monthly_price_php numeric(12,2) check(monthly_price_php>=0), active boolean not null default true
);
insert into public.subscription_plans values
 ('fleet_free','fleet','Free','["Fleet overview","Manual dispatch"]',0,true),
 ('fleet_starter','fleet','Starter','["Vehicles and drivers","Booking calendar"]',null,true),
 ('fleet_business','fleet','Business','["Fleet reporting","Priority operations"]',null,true),
 ('fleet_enterprise','fleet','Enterprise','["Custom fleet operations"]',null,true),
 ('partner_starter','partner','Starter','["Guest transport requests","Referral links"]',null,true),
 ('partner_business','partner','Business','["Multiple locations","Transport reporting"]',null,true),
 ('corporate_business','corporate','Business','["Employee rides","Monthly summaries"]',null,true),
 ('corporate_enterprise','corporate','Enterprise','["Custom corporate operations"]',null,true);
create table public.organization_subscriptions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null unique references public.organizations(id),
 plan_id text not null references public.subscription_plans(id), status text not null check(status in ('active','cancelled','expired')),
 starts_at timestamptz not null default now(), expires_at timestamptz not null check(expires_at>starts_at),
 billing_status text not null default 'manual_due' check(billing_status in ('manual_due','settled','waived')),
 updated_at timestamptz not null default now()
);
create table public.driver_preferences (
 driver_id uuid primary key references public.driver_profiles(id) on delete cascade,
 service_types text[] not null default array['scheduled','transfer','local','instant'] check(service_types <@ array['scheduled','transfer','local','instant']::text[] and cardinality(service_types)>0),
 preferred_areas text[] not null default '{}', destination_areas text[] not null default '{}',
 going_home_enabled boolean not null default false, home_address text,
 home_latitude double precision check(home_latitude between -90 and 90), home_longitude double precision check(home_longitude between -180 and 180),
 going_home_departure timestamptz, updated_at timestamptz not null default now(),
 check(not going_home_enabled or (home_latitude is not null and home_longitude is not null and going_home_departure is not null))
);
alter table public.ride_requests
 add column organization_id uuid references public.organizations(id),
 add column partner_id uuid references public.organizations(id),
 add column passenger_count integer not null default 1 check(passenger_count between 1 and 30),
 add column ride_purpose text check(length(ride_purpose)<=240), add column external_reference text check(length(external_reference)<=240),
 add column pickup_latitude double precision generated always as (public.st_y(pickup_location::public.geometry)) stored,
 add column pickup_longitude double precision generated always as (public.st_x(pickup_location::public.geometry)) stored,
 add column dropoff_latitude double precision generated always as (public.st_y(dropoff_location::public.geometry)) stored,
 add column dropoff_longitude double precision generated always as (public.st_x(dropoff_location::public.geometry)) stored,
 add column route_source text not null default 'local_estimate',
 add column route_preference text not null default 'fastest' check(route_preference in ('fastest','cheapest','avoid_tolls','preferred_route')),
 add column estimated_toll_amount numeric(12,2) check(estimated_toll_amount>=0),
 add column gross_fare numeric(12,2), add column commission_percent numeric(5,2),
 add column platform_commission numeric(12,2), add column driver_earnings numeric(12,2);
create index ride_requests_org_idx on public.ride_requests(organization_id,scheduled_at);
alter table public.ride_assignments add column confirmed_at timestamptz;
alter table public.trips add column gross_fare numeric(12,2), add column platform_commission numeric(12,2), add column driver_earnings numeric(12,2);
-- PIN plaintext is isolated in a schema unavailable to API roles; neither drivers nor operations can SELECT it.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
-- Resolve pgcrypto's installed schema: Supabase uses extensions, plain PostgreSQL may use public.
do $outer$ declare crypto_schema text; begin
 select n.nspname into crypto_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 execute format('create function private.secure_random_bytes(integer) returns bytea language sql set search_path='''' as %L',format('select %I.gen_random_bytes($1)',crypto_schema));
 execute format('create function private.hash_pin(text,text) returns text language sql set search_path='''' as %L',format('select %I.crypt($1,$2)',crypto_schema));
 execute format('create function private.pin_salt() returns text language sql set search_path='''' as %L',format('select %I.gen_salt(''bf'')',crypto_schema));
end $outer$;
revoke all on all functions in schema private from public,anon,authenticated;

create table private.trip_secrets (
 ride_request_id uuid primary key references public.ride_requests(id), pin text not null,
 failed_attempts integer not null default 0, locked_until timestamptz
);
create table public.backup_assignments (
 id uuid primary key default gen_random_uuid(), ride_request_id uuid not null unique references public.ride_requests(id),
 driver_id uuid not null references public.driver_profiles(id), vehicle_id uuid not null references public.vehicles(id),
 status text not null default 'ready' check(status in ('ready','activated','cancelled')), created_at timestamptz not null default now()
);
create index backup_assignments_driver_idx on public.backup_assignments(driver_id,status);
create table public.ride_messages (
 id uuid primary key default gen_random_uuid(), ride_request_id uuid not null references public.ride_requests(id),
 sender_user_id uuid not null references public.profiles(id), body text not null check(length(trim(body)) between 1 and 2000),
 client_message_id uuid not null, created_at timestamptz not null default now(), unique(sender_user_id,client_message_id)
);
create index ride_messages_ride_idx on public.ride_messages(ride_request_id,created_at);
create table public.ride_message_reads (
 ride_request_id uuid not null references public.ride_requests(id), user_id uuid not null references public.profiles(id),
 last_read_at timestamptz not null default now(), primary key(ride_request_id,user_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 title text not null, body text not null, ride_request_id uuid references public.ride_requests(id),
 read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create table public.safety_reports (
 id uuid primary key default gen_random_uuid(), ride_request_id uuid not null references public.ride_requests(id),
 reporter_user_id uuid not null references public.profiles(id), category text not null check(category in ('safety','driver','vehicle','payment','other')),
 details text not null check(length(trim(details)) between 1 and 4000), status text not null default 'open' check(status in ('open','reviewing','resolved')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index safety_reports_status_idx on public.safety_reports(status,created_at);
create table public.emergency_contacts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 name text not null check(length(trim(name)) between 1 and 100), phone text not null check(length(trim(phone)) between 7 and 30),
 created_at timestamptz not null default now()
);
create index emergency_contacts_user_idx on public.emergency_contacts(user_id);
create table public.referral_codes (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(id),
 organization_id uuid references public.organizations(id), code text not null unique default encode(private.secure_random_bytes(8),'hex'),
 referral_type text not null check(referral_type in ('driver','passenger','partner')), created_at timestamptz not null default now()
);
create index referral_codes_owner_idx on public.referral_codes(owner_user_id);
create table public.referral_events (
 id uuid primary key default gen_random_uuid(), referral_code_id uuid not null references public.referral_codes(id),
 referred_user_id uuid references public.profiles(id), status text not null check(status in ('referral_created','signup','qualified_activity','reward_pending','reward_approved','reward_rejected')),
 note text, created_at timestamptz not null default now()
);
create unique index referral_one_signup_idx on public.referral_events(referred_user_id) where status='signup';
create index referral_events_code_idx on public.referral_events(referral_code_id,created_at);
create table public.payments (
 id uuid primary key default gen_random_uuid(), ride_request_id uuid not null unique references public.ride_requests(id),
 provider text not null check(provider in ('cash','mock')), status text not null check(status in ('pending','paid','failed','refunded')),
 amount numeric(12,2) not null check(amount>=0), currency text not null default 'PHP' check(currency='PHP'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payment_events (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id),
 provider_event_id text not null unique, status text not null check(status in ('pending','paid','failed','refunded')),
 created_at timestamptz not null default now()
);

create function public.is_organization_member(p_organization_id uuid,p_manage boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members m join public.profiles p on p.id=m.user_id
 where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.status='active' and p.account_status='active'
 and (not p_manage or m.member_role in ('owner','manager')));
$$;
create function public.is_ride_participant(p_ride_request_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and account_status='active') and (
 exists(select 1 from public.ride_requests where id=p_ride_request_id and passenger_id=auth.uid()) or
 exists(select 1 from public.ride_assignments a join public.driver_profiles d on d.id=a.driver_id where a.ride_request_id=p_ride_request_id and d.user_id=auth.uid()));
$$;
create or replace function public.current_user_can_read_ride(target_ride_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.current_user_is_operations() or public.is_ride_participant(target_ride_id)
 or exists(select 1 from public.ride_requests r where r.id=target_ride_id and public.is_organization_member(r.organization_id,true))
 or exists(select 1 from public.ride_offers o join public.driver_profiles d on d.id=o.driver_id join public.profiles p on p.id=d.user_id
 where o.ride_request_id=target_ride_id and d.user_id=auth.uid() and p.account_status='active' and d.verification_status='verified'
 and o.status='pending' and o.expires_at>now())
 or exists(select 1 from public.backup_assignments b join public.driver_profiles d on d.id=b.driver_id
 where b.ride_request_id=target_ride_id and d.user_id=auth.uid() and b.status='ready');
$$;
create function public.audit_product_action(p_action text,p_entity_type text,p_entity_id uuid,p_metadata jsonb default '{}') returns void
language sql security definer set search_path='' as $$
 insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),p_action,p_entity_type,p_entity_id,p_metadata);
$$;
revoke all on function public.audit_product_action(text,text,uuid,jsonb) from public,anon,authenticated;

create function public.snapshot_ride_fare() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then
  perform 1 from public.profiles where id=auth.uid() for share;
  if new.organization_id is null and not public.current_user_has_role('passenger') then raise exception 'passenger role required'; end if;
 end if;
 select driver_commission_percent into new.commission_percent from public.app_config where id;
 new.gross_fare:=new.estimated_fare;
 new.platform_commission:=round(new.gross_fare*new.commission_percent/100,2);
 new.driver_earnings:=new.gross_fare-new.platform_commission;
 return new;
end; $$;
create trigger ride_fare_snapshot before insert on public.ride_requests for each row execute function public.snapshot_ride_fare();
update public.ride_requests set gross_fare=estimated_fare,commission_percent=0,platform_commission=0,driver_earnings=estimated_fare;

create function public.enforce_ride_transition() returns trigger language plpgsql security definer set search_path='' as $$
declare allowed text[];
begin
 if new.status=old.status then return new; end if;
 allowed:=case old.status
 when 'draft' then array['requested','passenger_cancelled']
 when 'requested' then array['searching','offered','assigned','passenger_cancelled','operator_cancelled','expired']
 when 'searching' then array['offered','assigned','no_driver_found','passenger_cancelled','operator_cancelled','expired']
 when 'offered' then array['assigned','searching','passenger_cancelled','operator_cancelled','expired']
 when 'assigned' then array['driver_en_route','driver_cancelled','passenger_cancelled','operator_cancelled']
 when 'driver_en_route' then array['driver_arrived','driver_cancelled','passenger_cancelled','operator_cancelled']
 when 'driver_arrived' then array['trip_started','no_show','driver_cancelled','passenger_cancelled','operator_cancelled']
 when 'trip_started' then array['trip_completed','operator_cancelled'] else array[]::text[] end;
 if not new.status::text=any(allowed) then raise exception 'invalid ride state transition: % -> %',old.status,new.status; end if;
 insert into public.ride_request_events(ride_request_id,actor_user_id,event_type,from_status,to_status)
 values(new.id,auth.uid(),'status_changed',old.status,new.status);
 insert into public.notifications(user_id,title,body,ride_request_id) values(new.passenger_id,'Booking updated',replace(new.status::text,'_',' '),new.id);
 insert into public.notifications(user_id,title,body,ride_request_id)
 select d.user_id,'Booking updated',replace(new.status::text,'_',' '),new.id from public.ride_assignments a join public.driver_profiles d on d.id=a.driver_id where a.ride_request_id=new.id;
 return new;
end; $$;
create trigger enforce_ride_transition before update of status on public.ride_requests for each row execute function public.enforce_ride_transition();

create function public.driver_can_take_ride(p_driver_id uuid,p_vehicle_id uuid,p_ride_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
 select 1 from public.driver_profiles d join public.profiles p on p.id=d.user_id
 join public.driver_vehicles dv on dv.driver_id=d.id and dv.vehicle_id=p_vehicle_id and dv.active
 join public.vehicles v on v.id=dv.vehicle_id join public.ride_requests r on r.id=p_ride_id
 left join public.driver_preferences pref on pref.driver_id=d.id
 where d.id=p_driver_id and d.verification_status='verified' and d.online and p.account_status='active' and p.role='driver'
 and v.verified and v.active and v.vehicle_type=r.vehicle_type and v.capacity>=r.passenger_count
 and (pref.driver_id is null or r.service_type=any(pref.service_types))
 and exists(select 1 from public.driver_documents doc where doc.driver_id=d.id and doc.document_type='drivers_license' and doc.verification_status='verified' and (doc.expires_on is null or doc.expires_on>=coalesce(r.scheduled_at,now())::date))
 and exists(select 1 from public.vehicle_documents doc where doc.vehicle_id=v.id and doc.document_type='registration' and doc.verification_status='verified' and (doc.expires_on is null or doc.expires_on>=coalesce(r.scheduled_at,now())::date))
 and not exists(select 1 from public.ride_assignments a join public.ride_requests other on other.id=a.ride_request_id
 where (a.driver_id=d.id or a.vehicle_id=v.id) and other.id<>r.id and other.status in ('assigned','driver_en_route','driver_arrived','trip_started')
 and tstzrange(coalesce(other.scheduled_at,other.created_at)-interval '30 minutes',coalesce(other.scheduled_at,other.created_at)+make_interval(secs=>coalesce(other.estimated_duration_seconds,3600))+interval '30 minutes','[)')
 && tstzrange(coalesce(r.scheduled_at,r.created_at),coalesce(r.scheduled_at,r.created_at)+make_interval(secs=>coalesce(r.estimated_duration_seconds,3600)),'[)'))
 );
$$;
revoke all on function public.driver_can_take_ride(uuid,uuid,uuid) from public,anon,authenticated;
create function public.guard_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Ride is always locked first; driver and vehicle serialize overlapping acceptance across distinct rides.
 perform 1 from public.ride_requests where id=new.ride_request_id for update;
 perform 1 from public.driver_profiles where id=new.driver_id for update;
 perform 1 from public.profiles where id=(select user_id from public.driver_profiles where id=new.driver_id) for share;
 perform 1 from public.vehicles where id=new.vehicle_id for update;
 if not public.driver_can_take_ride(new.driver_id,new.vehicle_id,new.ride_request_id) then raise exception 'driver, documents, vehicle or schedule no longer eligible'; end if;
 return new;
end; $$;
create trigger guard_assignment before insert or update of driver_id,vehicle_id on public.ride_assignments for each row execute function public.guard_assignment();
create trigger guard_backup_assignment before insert or update of driver_id,vehicle_id on public.backup_assignments for each row execute function public.guard_assignment();

-- Create trip/PIN in the assignment transaction. Reassignment rotates the PIN before any start.
create function public.initialize_assigned_trip() returns trigger language plpgsql security definer set search_path='' as $$
declare new_pin text; r public.ride_requests%rowtype;
begin
 select * into r from public.ride_requests where id=new.ride_request_id;
 if exists(select 1 from public.trips where ride_request_id=r.id and started_at is not null) then raise exception 'started trip cannot be reassigned'; end if;
 new_pin:=lpad(((('x'||encode(private.secure_random_bytes(4),'hex'))::bit(32)::bigint)%1000000)::text,6,'0');
 insert into private.trip_secrets(ride_request_id,pin) values(r.id,new_pin)
 on conflict(ride_request_id) do update set pin=excluded.pin,failed_attempts=0,locked_until=null;
 insert into public.trips(ride_request_id,driver_id,passenger_id,vehicle_id,trip_pin_hash,gross_fare,platform_commission,driver_earnings)
 values(r.id,new.driver_id,r.passenger_id,new.vehicle_id,private.hash_pin(new_pin,private.pin_salt()),r.gross_fare,r.platform_commission,r.driver_earnings)
 on conflict(ride_request_id) do update set driver_id=excluded.driver_id,vehicle_id=excluded.vehicle_id,trip_pin_hash=excluded.trip_pin_hash;
 return new;
end; $$;
create trigger initialize_assigned_trip after insert or update of driver_id,vehicle_id on public.ride_assignments for each row execute function public.initialize_assigned_trip();

-- Existing unstarted assignments receive isolated passenger PINs during upgrade too.
insert into private.trip_secrets(ride_request_id,pin)
select a.ride_request_id,lpad(((('x'||encode(private.secure_random_bytes(4),'hex'))::bit(32)::bigint)%1000000)::text,6,'0')
from public.ride_assignments a join public.ride_requests r on r.id=a.ride_request_id
where r.status in ('assigned','driver_en_route','driver_arrived')
on conflict(ride_request_id) do nothing;
insert into public.trips(ride_request_id,driver_id,passenger_id,vehicle_id,trip_pin_hash,gross_fare,platform_commission,driver_earnings)
select a.ride_request_id,a.driver_id,r.passenger_id,a.vehicle_id,private.hash_pin(s.pin,private.pin_salt()),r.gross_fare,r.platform_commission,r.driver_earnings
from public.ride_assignments a join public.ride_requests r on r.id=a.ride_request_id join private.trip_secrets s on s.ride_request_id=r.id
on conflict(ride_request_id) do update set trip_pin_hash=excluded.trip_pin_hash,gross_fare=excluded.gross_fare,platform_commission=excluded.platform_commission,driver_earnings=excluded.driver_earnings where trips.started_at is null;

create function public.current_user_can_dispatch() returns boolean language sql stable security definer set search_path='' as $$
 select public.current_user_is_operations() or exists(select 1 from public.fleets f join public.profiles p on p.id=f.owner_user_id where f.owner_user_id=auth.uid() and p.account_status='active');
$$;

create function public.current_user_can_dispatch_ride(p_ride_request_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.current_user_is_operations() or exists(select 1 from public.ride_requests r join public.organizations o on o.id=r.organization_id join public.fleets f on f.id=o.fleet_id where r.id=p_ride_request_id and o.kind='fleet' and f.owner_user_id=auth.uid() and public.is_organization_member(o.id,true));
$$;
revoke all on function public.current_user_can_dispatch_ride(uuid) from public,anon,authenticated;
grant execute on function public.current_user_can_dispatch_ride(uuid) to authenticated;

create function public.driver_effective_pickup_distance(p_driver_id uuid,p_ride_id uuid) returns integer
language sql stable security definer set search_path='' as $$
 select round(least(public.st_distance(d.current_location,r.pickup_location),(
 select min(public.st_distance(outbound.dropoff_location,r.pickup_location)) from public.ride_assignments a join public.ride_requests outbound on outbound.id=a.ride_request_id
 where a.driver_id=d.id and outbound.id<>r.id and outbound.status in ('assigned','driver_en_route','driver_arrived','trip_started')
 and coalesce(outbound.scheduled_at,outbound.created_at)+make_interval(secs=>coalesce(outbound.estimated_duration_seconds,3600))+interval '30 minutes'<=r.scheduled_at
 and r.scheduled_at<=coalesce(outbound.scheduled_at,outbound.created_at)+make_interval(secs=>coalesce(outbound.estimated_duration_seconds,3600))+interval '8 hours'
 )))::integer from public.driver_profiles d join public.ride_requests r on r.id=p_ride_id where d.id=p_driver_id;
$$;
revoke all on function public.driver_effective_pickup_distance(uuid,uuid) from public,anon,authenticated;

create or replace function public.find_eligible_drivers(p_ride_request_id uuid,p_radius_meters integer default null,p_limit integer default 20)
returns table(driver_id uuid,vehicle_id uuid,driver_user_id uuid,distance_meters integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.current_user_can_dispatch_ride(p_ride_request_id) then raise exception 'operations role required'; end if;
 p_radius_meters:=coalesce(p_radius_meters,(select default_matching_radius_km*1000 from public.app_config where id));
 if p_radius_meters is null or p_radius_meters not between 1000 and 100000 or p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid search range'; end if;
 return query select c.driver_id,c.vehicle_id,c.driver_user_id,c.distance_meters from (
 select distinct on(d.id) d.id driver_id,v.id vehicle_id,d.user_id driver_user_id,public.driver_effective_pickup_distance(d.id,r.id) distance_meters
 from public.ride_requests r join public.driver_profiles d on d.online join public.driver_vehicles dv on dv.driver_id=d.id and dv.active join public.vehicles v on v.id=dv.vehicle_id
 where r.id=p_ride_request_id and r.status in ('requested','searching','offered','assigned','driver_en_route','driver_arrived')
 and public.driver_can_take_ride(d.id,v.id,r.id) and d.current_location is not null and public.driver_effective_pickup_distance(d.id,r.id)<=p_radius_meters
 and (public.current_user_is_operations() or exists(select 1 from public.fleets f where f.id=v.fleet_id and f.owner_user_id=auth.uid()))
 order by d.id,dv.is_primary desc,v.id) c order by c.distance_meters,c.driver_id limit p_limit;
end; $$;

create function public.save_driver_preferences(p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d uuid; services text[]; areas text[]; destinations text[];
begin
 if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
 select id into d from public.driver_profiles where user_id=auth.uid() for update;
 if d is null then raise exception 'driver profile required'; end if;
 services:=array(select jsonb_array_elements_text(coalesce(p_payload->'service_types','["scheduled","transfer","local","instant"]')));
 areas:=array(select jsonb_array_elements_text(coalesce(p_payload->'preferred_areas','[]')));
 destinations:=array(select jsonb_array_elements_text(coalesce(p_payload->'destination_areas','[]')));
 if cardinality(areas)>30 or cardinality(destinations)>30 or length(p_payload::text)>10000 then raise exception 'preferences too large'; end if;
 insert into public.driver_preferences(driver_id,service_types,preferred_areas,destination_areas,going_home_enabled,home_address,home_latitude,home_longitude,going_home_departure)
 values(d,services,areas,destinations,coalesce((p_payload->>'going_home_enabled')::boolean,false),left(p_payload->>'home_address',240),(p_payload->>'home_latitude')::double precision,(p_payload->>'home_longitude')::double precision,(p_payload->>'going_home_departure')::timestamptz)
 on conflict(driver_id) do update set service_types=excluded.service_types,preferred_areas=excluded.preferred_areas,destination_areas=excluded.destination_areas,going_home_enabled=excluded.going_home_enabled,home_address=excluded.home_address,home_latitude=excluded.home_latitude,home_longitude=excluded.home_longitude,going_home_departure=excluded.going_home_departure,updated_at=now();
end; $$;
create function public.publish_driver_location(p_latitude double precision,p_longitude double precision) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
 if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'invalid coordinates'; end if;
 update public.driver_profiles set current_location=public.st_setsrid(public.st_makepoint(p_longitude,p_latitude),4326)::public.geography where user_id=auth.uid() and verification_status='verified';
 if not found then raise exception 'verified driver required'; end if;
end; $$;

create function public.create_transport_request(p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid; org uuid; rider uuid; request_key uuid; quote record; service text; scheduled timestamptz; seats integer; vehicle text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'active account required'; end if;
 org:=(p_payload->>'organization_id')::uuid; rider:=coalesce((p_payload->>'passenger_id')::uuid,auth.uid());
 if org is null then
  if not public.current_user_has_role('passenger') or rider<>auth.uid() then raise exception 'passenger role required'; end if;
 else
  if not public.is_organization_member(org,true) then raise exception 'organization manager required'; end if;
  if rider<>auth.uid() and not exists(select 1 from public.organization_members m join public.profiles p on p.id=m.user_id where m.organization_id=org and m.user_id=rider and m.status='active' and p.account_status='active') then raise exception 'authorized organization rider required'; end if;
 end if;
 if p_payload->>'partner_id' is not null and not exists(select 1 from public.organizations where id=(p_payload->>'partner_id')::uuid and kind='partner') then raise exception 'partner not found'; end if;
 request_key:=(p_payload->>'client_request_id')::uuid;
 if request_key is null then raise exception 'request id required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(rider::text||':'||request_key::text,0));
 select id into r from public.ride_requests where passenger_id=rider and client_request_id=request_key;
 if r is not null then
  if not public.current_user_can_read_ride(r) then raise exception 'request key conflict'; end if;
  return r;
 end if;
 if nullif(trim(p_payload->>'pickup_address'),'') is null or length(p_payload->>'pickup_address')>240 or nullif(trim(p_payload->>'dropoff_address'),'') is null or length(p_payload->>'dropoff_address')>240 then raise exception 'valid addresses required'; end if;
 service:=coalesce(p_payload->>'service_type','scheduled'); scheduled:=(p_payload->>'scheduled_at')::timestamptz;
 if service not in ('scheduled','transfer','local','instant') then raise exception 'invalid service'; end if;
 if service in ('scheduled','transfer') and (scheduled is null or scheduled<now()+interval '30 minutes' or scheduled>now()+interval '180 days') then raise exception 'schedule must be 30 minutes to 180 days ahead'; end if;
 if scheduled is not null and (scheduled<now() or scheduled>now()+interval '180 days') then raise exception 'invalid schedule'; end if;
 seats:=coalesce((p_payload->>'passenger_count')::integer,1); vehicle:=p_payload->>'vehicle_type';
 if seats<1 or seats>(case vehicle when 'motorcycle' then 1 when 'sedan' then 4 when 'suv' then 6 when 'van' then 15 else 0 end) then raise exception 'passenger count exceeds vehicle category'; end if;
 select * into quote from public.placeholder_scheduled_fare((p_payload->>'pickup_lat')::double precision,(p_payload->>'pickup_lng')::double precision,(p_payload->>'dropoff_lat')::double precision,(p_payload->>'dropoff_lng')::double precision,vehicle);
 insert into public.ride_requests(passenger_id,client_request_id,organization_id,pickup_address,pickup_location,dropoff_address,dropoff_location,service_type,vehicle_type,scheduled_at,estimated_distance_meters,estimated_duration_seconds,estimated_fare,passenger_notes,status,passenger_count,ride_purpose,external_reference,route_preference,partner_id)
 values(rider,request_key,org,trim(p_payload->>'pickup_address'),public.st_setsrid(public.st_makepoint((p_payload->>'pickup_lng')::double precision,(p_payload->>'pickup_lat')::double precision),4326)::public.geography,trim(p_payload->>'dropoff_address'),public.st_setsrid(public.st_makepoint((p_payload->>'dropoff_lng')::double precision,(p_payload->>'dropoff_lat')::double precision),4326)::public.geography,service,vehicle,scheduled,quote.distance_meters,quote.duration_seconds,quote.estimated_fare,nullif(trim(p_payload->>'passenger_notes'),''),'requested',seats,p_payload->>'ride_purpose',p_payload->>'external_reference',coalesce(p_payload->>'route_preference','fastest'),(p_payload->>'partner_id')::uuid) returning id into r;
 insert into public.ride_request_events(ride_request_id,actor_user_id,event_type,to_status,metadata) values(r,auth.uid(),'created','requested','{"fare_calculator":"placeholder_v1","route_source":"local_estimate"}');
 return r;
end; $$;

create function public.get_passenger_trip_pin(p_ride_request_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if not exists(select 1 from public.ride_requests where id=p_ride_request_id and passenger_id=auth.uid() and status in ('assigned','driver_en_route','driver_arrived')) then raise exception 'passenger PIN unavailable'; end if;
 select pin into result from private.trip_secrets where ride_request_id=p_ride_request_id;
 return result;
end; $$;
create function public.advance_trip(p_ride_request_id uuid,p_action text,p_pin text default null) returns public.ride_status
language plpgsql security definer set search_path='' as $$
declare r public.ride_requests%rowtype; t public.trips%rowtype; desired public.ride_status; secret private.trip_secrets%rowtype;
begin
 if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
 select * into r from public.ride_requests where id=p_ride_request_id for update;
 if r.id is null or not exists(select 1 from public.ride_assignments a join public.driver_profiles d on d.id=a.driver_id where a.ride_request_id=r.id and d.user_id=auth.uid() and d.verification_status='verified') then raise exception 'assigned verified driver required'; end if;
 desired:=case p_action when 'heading' then 'driver_en_route' when 'arrived' then 'driver_arrived' when 'start' then 'trip_started' when 'complete' then 'trip_completed' when 'cancel' then 'driver_cancelled' when 'no_show' then 'no_show' else null end;
 if desired is null then raise exception 'unknown trip action'; end if;
 perform 1 from public.driver_profiles where id=(select driver_id from public.ride_assignments where ride_request_id=r.id) for update;
 perform 1 from public.vehicles where id=(select vehicle_id from public.ride_assignments where ride_request_id=r.id) for update;
 if p_action in ('heading','start') and exists(select 1 from public.ride_assignments a join public.ride_requests other on other.id=a.ride_request_id where other.id<>r.id and other.status='trip_started' and (a.driver_id=(select driver_id from public.ride_assignments where ride_request_id=r.id) or a.vehicle_id=(select vehicle_id from public.ride_assignments where ride_request_id=r.id))) then raise exception 'another trip is still in progress'; end if;

 if r.status=desired then return r.status; end if;
 if not ((r.status='assigned' and p_action='heading') or (r.status='driver_en_route' and p_action='arrived') or (r.status='driver_arrived' and p_action in ('start','no_show')) or (r.status='trip_started' and p_action='complete') or (r.status in ('assigned','driver_en_route','driver_arrived') and p_action='cancel')) then raise exception 'invalid trip action for current state'; end if;
 select * into t from public.trips where ride_request_id=r.id for update;
 if t.id is null then raise exception 'trip unavailable'; end if;
 if p_action='start' then
  if coalesce(r.scheduled_at,r.created_at)>now()+interval '30 minutes' then raise exception 'too early to start scheduled trip'; end if;
  select * into secret from private.trip_secrets where ride_request_id=r.id for update;
  if secret.locked_until>now() then raise exception 'PIN temporarily locked'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' or private.hash_pin(p_pin,t.trip_pin_hash)<>t.trip_pin_hash then
   -- Return unchanged status instead of raising so failed-attempt counters commit.
   update private.trip_secrets set failed_attempts=case when locked_until<=now() then 1 else failed_attempts+1 end,
    locked_until=case when (case when locked_until<=now() then 1 else failed_attempts+1 end)>=5 then now()+interval '15 minutes' else null end where ride_request_id=r.id;
   return r.status;
  end if;
  update public.trips set started_at=now() where id=t.id;
 elsif p_action='no_show' then
  if now()<greatest(coalesce(r.scheduled_at,r.created_at),coalesce((select max(created_at) from public.ride_request_events where ride_request_id=r.id and to_status='driver_arrived'),now()))+interval '10 minutes' then raise exception 'no-show waiting period has not elapsed'; end if;
 elsif p_action='complete' then
  update public.trips set completed_at=now(),actual_duration_seconds=greatest(0,extract(epoch from now()-started_at)::integer),final_fare=r.gross_fare,gross_fare=r.gross_fare,platform_commission=r.platform_commission,driver_earnings=r.driver_earnings where id=t.id and completed_at is null;
  insert into public.payments(ride_request_id,provider,status,amount) values(r.id,'cash','pending',r.gross_fare) on conflict(ride_request_id) do nothing;
 end if;
 update public.ride_requests set status=desired where id=r.id;
 perform public.audit_product_action('trip_'||p_action,'ride',r.id);
 return desired;
end; $$;
create function public.confirm_ride_assignment(p_ride_request_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
 perform 1 from public.ride_requests where id=p_ride_request_id and status in ('assigned','driver_en_route','driver_arrived') for update;
 if not found then raise exception 'active assignment required'; end if;
 update public.ride_assignments set confirmed_at=coalesce(confirmed_at,now()) where ride_request_id=p_ride_request_id and driver_id in (select id from public.driver_profiles where user_id=auth.uid());
 if not found then raise exception 'assigned driver required'; end if;
end; $$;
create function public.decline_ride_offer(p_offer_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare ride_id uuid;
begin
 if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
 select o.ride_request_id into ride_id from public.ride_offers o join public.driver_profiles d on d.id=o.driver_id where o.id=p_offer_id and d.user_id=auth.uid();
 if ride_id is null then raise exception 'offer not found'; end if;
 perform 1 from public.ride_requests where id=ride_id for update;
 update public.ride_offers set status='declined' where id=p_offer_id and status='pending';
 if not exists(select 1 from public.ride_offers where ride_request_id=ride_id and status='pending' and expires_at>now()) then update public.ride_requests set status='searching' where id=ride_id and status='offered'; end if;
end; $$;
create function public.get_assigned_driver(p_ride_request_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not (public.is_ride_participant(p_ride_request_id) or public.current_user_is_operations()) then raise exception 'trip participant required'; end if;
 select jsonb_build_object('driver_id',d.id,'name',concat_ws(' ',p.first_name,p.last_name),'verification_status',d.verification_status,'rating',d.rating,'rating_count',d.rating_count,'vehicle_type',v.vehicle_type,'brand',v.brand,'model',v.model,'color',v.color,'plate_number',v.plate_number,'capacity',v.capacity)
 into result from public.ride_assignments a join public.driver_profiles d on d.id=a.driver_id join public.profiles p on p.id=d.user_id join public.vehicles v on v.id=a.vehicle_id where a.ride_request_id=p_ride_request_id;
 return result;
end; $$;
create function public.send_ride_message(p_ride_request_id uuid,p_body text,p_client_message_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; existing_ride uuid;
begin
 if not public.is_ride_participant(p_ride_request_id) then raise exception 'trip participant required'; end if;
 if not exists(select 1 from public.ride_assignments where ride_request_id=p_ride_request_id) then raise exception 'assigned booking required'; end if;
 if p_client_message_id is null then raise exception 'message request id required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_client_message_id::text,1));
 select id,ride_request_id into result,existing_ride from public.ride_messages where sender_user_id=auth.uid() and client_message_id=p_client_message_id;
 if result is not null then
  if existing_ride<>p_ride_request_id then raise exception 'message request key conflict'; end if;
  return result;
 end if;
 insert into public.ride_messages(ride_request_id,sender_user_id,body,client_message_id) values(p_ride_request_id,auth.uid(),trim(p_body),p_client_message_id) returning id into result;
 insert into public.notifications(user_id,title,body,ride_request_id)
 select recipient,'New trip message','Open your booking to read the message.',p_ride_request_id from (
 select passenger_id recipient from public.ride_requests where id=p_ride_request_id union
 select d.user_id from public.ride_assignments a join public.driver_profiles d on d.id=a.driver_id where a.ride_request_id=p_ride_request_id) users where recipient<>auth.uid();
 return result;
end; $$;
create function public.mark_ride_messages_read(p_ride_request_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_ride_participant(p_ride_request_id) then raise exception 'trip participant required'; end if;
 insert into public.ride_message_reads(ride_request_id,user_id) values(p_ride_request_id,auth.uid()) on conflict(ride_request_id,user_id) do update set last_read_at=now();
end; $$;
create function public.mark_notification_read(p_notification_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=auth.uid();
 if not found then raise exception 'notification not found'; end if;
end; $$;
create function public.report_ride_safety(p_ride_request_id uuid,p_category text,p_details text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_ride_participant(p_ride_request_id) then raise exception 'trip participant required'; end if;
 insert into public.safety_reports(ride_request_id,reporter_user_id,category,details) values(p_ride_request_id,auth.uid(),p_category,trim(p_details)) returning id into result;
 perform public.audit_product_action('safety_report_created','safety_report',result);
 return result;
end; $$;
create function public.admin_resolve_safety_report(p_report_id uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_is_operations() then raise exception 'operations role required'; end if;
 if nullif(trim(p_note),'') is null or length(p_note)>2000 then raise exception 'review note required'; end if;
 update public.safety_reports set status=p_status,updated_at=now() where id=p_report_id;
 if not found then raise exception 'report not found'; end if;
 perform public.audit_product_action('safety_report_reviewed','safety_report',p_report_id,jsonb_build_object('status',p_status,'note',p_note));
end; $$;
create function public.save_emergency_contact(p_name text,p_phone text,p_contact_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if p_contact_id is null then
  perform 1 from public.profiles where id=auth.uid() for update;
  if (select count(*) from public.emergency_contacts where user_id=auth.uid())>=5 then raise exception 'maximum five emergency contacts'; end if;
  insert into public.emergency_contacts(user_id,name,phone) values(auth.uid(),trim(p_name),trim(p_phone)) returning id into result;
 else
  update public.emergency_contacts set name=trim(p_name),phone=trim(p_phone) where id=p_contact_id and user_id=auth.uid() returning id into result;
  if result is null then raise exception 'contact not found'; end if;
 end if;
 return result;
end; $$;
create function public.delete_emergency_contact(p_contact_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin delete from public.emergency_contacts where id=p_contact_id and user_id=auth.uid(); end; $$;

alter table public.app_config
 add column default_matching_radius_km integer not null default 25 check(default_matching_radius_km between 1 and 100),
 add column offer_timeout_seconds integer not null default 120 check(offer_timeout_seconds between 30 and 3600),
 add column scheduled_confirmation_hours integer not null default 1 check(scheduled_confirmation_hours between 1 and 24),
 add column backup_driver_enabled boolean not null default true,
 add column mock_route_speed_kph integer not null default 30 check(mock_route_speed_kph between 5 and 120),
 add column mock_payment_enabled boolean not null default false,
 add column mock_notifications_enabled boolean not null default false;
alter table public.organization_subscriptions drop constraint organization_subscriptions_status_check;
alter table public.organization_subscriptions add constraint organization_subscriptions_status_check check(status in ('trial','active','past_due','cancelled','expired'));
create index ride_requests_partner_idx on public.ride_requests(partner_id,created_at);

create function public.create_organization(p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; fleet uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'active account required'; end if;
 if p_payload->>'kind'='fleet' then
  insert into public.fleets(owner_user_id,business_name) values(auth.uid(),trim(p_payload->>'name')) returning id into fleet;
 end if;
 insert into public.organizations(kind,name,owner_user_id,partner_type,external_reference,fleet_id)
 values(p_payload->>'kind',trim(p_payload->>'name'),auth.uid(),p_payload->>'partner_type',left(p_payload->>'external_reference',240),fleet) returning id into result;
 insert into public.organization_members(organization_id,user_id,member_role) values(result,auth.uid(),'owner');
 perform public.audit_product_action('organization_created','organization',result);
 return result;
end; $$;
create function public.save_organization_member(p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid; target uuid; result uuid; owner uuid;
begin
 org:=(p_payload->>'organization_id')::uuid;
 if not (public.is_organization_member(org,true) or public.current_user_is_operations()) then raise exception 'organization manager required'; end if;
 select owner_user_id into owner from public.organizations where id=org for update;
 target:=(p_payload->>'user_id')::uuid;
 if target is null then select id into target from public.profiles where lower(email)=lower(trim(p_payload->>'email')) and account_status='active' limit 1; end if;
 if target is null then raise exception 'active registered member not found'; end if;
 if target=owner or p_payload->>'member_role'='owner' then raise exception 'ownership cannot be changed through membership'; end if;
 if not exists(select 1 from public.profiles where id=target and account_status='active') then raise exception 'active registered member required'; end if;
 insert into public.organization_members(organization_id,user_id,member_role,status) values(org,target,p_payload->>'member_role',coalesce(p_payload->>'status','active'))
 on conflict(organization_id,user_id) do update set member_role=excluded.member_role,status=excluded.status,updated_at=now() returning id into result;
 perform public.audit_product_action('organization_member_saved','organization',org,jsonb_build_object('user_id',target));
 return result;
end; $$;
create function public.save_organization_location(p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid; result uuid;
begin
 org:=(p_payload->>'organization_id')::uuid;
 if not public.is_organization_member(org,true) then raise exception 'organization manager required'; end if;
 insert into public.organization_locations(organization_id,label,address,latitude,longitude) values(org,trim(p_payload->>'label'),trim(p_payload->>'address'),(p_payload->>'latitude')::double precision,(p_payload->>'longitude')::double precision) returning id into result;
 return result;
end; $$;
create function public.admin_manage_subscription(p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; org uuid; kind text;
begin
 if not public.current_user_has_role('admin') then raise exception 'admin role required'; end if;
 org:=(p_payload->>'organization_id')::uuid;
 select o.kind into kind from public.organizations o where id=org for update;
 if not exists(select 1 from public.subscription_plans where id=p_payload->>'plan_id' and audience=kind and active) then raise exception 'active compatible plan required'; end if;
 insert into public.organization_subscriptions(organization_id,plan_id,status,expires_at,billing_status)
 values(org,p_payload->>'plan_id',p_payload->>'status',(p_payload->>'expires_at')::timestamptz,coalesce(p_payload->>'billing_status','manual_due'))
 on conflict(organization_id) do update set plan_id=excluded.plan_id,status=excluded.status,expires_at=excluded.expires_at,billing_status=excluded.billing_status,updated_at=now() returning id into result;
 perform public.audit_product_action('subscription_managed','organization',org,jsonb_build_object('plan_id',p_payload->>'plan_id','status',p_payload->>'status','expires_at',p_payload->>'expires_at','billing_status',p_payload->>'billing_status'));
 return result;
end; $$;
create function public.admin_update_config(p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_has_role('admin') then raise exception 'admin role required'; end if;
 update public.app_config set driver_commission_percent=coalesce((p_payload->>'driver_commission_percent')::numeric,driver_commission_percent),
 demo_mode=coalesce((p_payload->>'demo_mode')::boolean,demo_mode), confirmation_minutes=coalesce((p_payload->>'confirmation_minutes')::integer,confirmation_minutes),
 matching_weights=coalesce(p_payload->'matching_weights',matching_weights),
 default_matching_radius_km=coalesce((p_payload->>'default_matching_radius_km')::integer,default_matching_radius_km),
 offer_timeout_seconds=coalesce((p_payload->>'offer_timeout_seconds')::integer,offer_timeout_seconds),
 scheduled_confirmation_hours=coalesce((p_payload->>'scheduled_confirmation_hours')::integer,scheduled_confirmation_hours),
 backup_driver_enabled=coalesce((p_payload->>'backup_driver_enabled')::boolean,backup_driver_enabled),
 mock_route_speed_kph=coalesce((p_payload->>'mock_route_speed_kph')::integer,mock_route_speed_kph),
 mock_payment_enabled=coalesce((p_payload->>'mock_payment_enabled')::boolean,mock_payment_enabled),
 mock_notifications_enabled=coalesce((p_payload->>'mock_notifications_enabled')::boolean,mock_notifications_enabled),updated_at=now() where id;
 perform public.audit_product_action('configuration_updated','configuration',null,p_payload);
end; $$;
create function public.admin_review_driver(p_driver_id uuid,p_decision text,p_reason text default null) returns void language plpgsql security definer set search_path='' as $$
declare d public.driver_profiles%rowtype; v uuid;
begin
 if not public.current_user_is_operations() then raise exception 'operations role required'; end if;
 if p_decision is null or p_decision not in ('verified','rejected','suspended') then raise exception 'invalid decision'; end if;
 if p_decision<>'verified' and nullif(trim(p_reason),'') is null then raise exception 'review reason required'; end if;
 select * into d from public.driver_profiles where id=p_driver_id for update;
 if d.id is null then raise exception 'driver not found'; end if;
 select vehicle_id into v from public.driver_vehicles where driver_id=d.id and is_primary and active;
 perform 1 from public.vehicles where id=v for update;
 if p_decision='verified' then
  if v is null then raise exception 'primary vehicle required'; end if;
  if not exists(select 1 from public.driver_documents doc join storage.objects o on o.bucket_id='driver-documents' and o.name=doc.storage_path and o.owner_id=d.user_id::text where doc.driver_id=d.id and doc.document_type='drivers_license' and (doc.expires_on is null or doc.expires_on>=current_date)) then raise exception 'valid driver license object required'; end if;
  if not exists(select 1 from public.vehicle_documents doc join storage.objects o on o.bucket_id='vehicle-documents' and o.name=doc.storage_path join public.vehicles vehicle on vehicle.id=doc.vehicle_id and o.owner_id=vehicle.owner_user_id::text where doc.vehicle_id=v and doc.document_type='registration' and (doc.expires_on is null or doc.expires_on>=current_date)) then raise exception 'valid registration object required'; end if;
 end if;
 update public.driver_documents set verification_status=p_decision::public.verification_status,reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=case when p_decision='rejected' then p_reason else null end where driver_id=d.id and document_type='drivers_license';
 update public.vehicle_documents set verification_status=p_decision::public.verification_status,reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=case when p_decision='rejected' then p_reason else null end where vehicle_id=v and document_type='registration';
 update public.vehicles set verified=(p_decision='verified') where id=v;
 update public.driver_profiles set verification_status=p_decision::public.verification_status,online=false where id=d.id;
 perform public.audit_product_action('driver_reviewed','driver',d.id,jsonb_build_object('decision',p_decision,'reason',p_reason));
 insert into public.notifications(user_id,title,body) values(d.user_id,'Driver verification updated',p_decision||coalesce(': '||p_reason,''));
end; $$;
create function public.admin_set_backup_driver(p_ride_request_id uuid,p_driver_id uuid,p_vehicle_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.current_user_is_operations() then raise exception 'operations role required'; end if;
 if not (select backup_driver_enabled from public.app_config where id) then raise exception 'backup driver feature disabled'; end if;
 perform 1 from public.ride_requests where id=p_ride_request_id and status in ('assigned','driver_en_route','driver_arrived') and scheduled_at is not null for update;
 if not found then raise exception 'scheduled active assignment required'; end if;
 if exists(select 1 from public.ride_assignments where ride_request_id=p_ride_request_id and driver_id=p_driver_id) then raise exception 'backup must differ from primary'; end if;
 insert into public.backup_assignments(ride_request_id,driver_id,vehicle_id) values(p_ride_request_id,p_driver_id,p_vehicle_id)
 on conflict(ride_request_id) do update set driver_id=excluded.driver_id,vehicle_id=excluded.vehicle_id,status='ready' returning id into result;
 perform public.audit_product_action('backup_assigned','ride',p_ride_request_id,jsonb_build_object('driver_id',p_driver_id));
 return result;
end; $$;
create function public.admin_activate_backup(p_ride_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.backup_assignments%rowtype; result uuid;
begin
 if not public.current_user_is_operations() then raise exception 'operations role required'; end if;
 perform 1 from public.ride_requests where id=p_ride_request_id and status='assigned' for update;
 if not found then raise exception 'backup activation requires assigned state before heading'; end if;
 select * into b from public.backup_assignments where ride_request_id=p_ride_request_id for update;
 if b.id is null then raise exception 'backup not found'; end if;
 if b.status='activated' then select id into result from public.ride_assignments where ride_request_id=p_ride_request_id; return result; end if;
 if b.status<>'ready' then raise exception 'backup not ready'; end if;
 update public.ride_assignments set driver_id=b.driver_id,vehicle_id=b.vehicle_id,fleet_id=(select fleet_id from public.vehicles where id=b.vehicle_id),assignment_type='admin',assigned_at=now(),confirmed_at=null where ride_request_id=p_ride_request_id returning id into result;
 update public.backup_assignments set status='activated' where id=b.id;
 update public.ride_offers set status='cancelled' where ride_request_id=p_ride_request_id and status in ('pending','accepted');
 perform public.audit_product_action('backup_activated','ride',p_ride_request_id,jsonb_build_object('driver_id',b.driver_id));
 insert into public.notifications(user_id,title,body,ride_request_id) select user_id,'Backup activated','You are now the primary driver. Confirm your scheduled trip.',p_ride_request_id from public.driver_profiles where id=b.driver_id;
 return result;
end; $$;
create function public.create_referral_code(p_referral_type text,p_organization_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'active account required'; end if;
 if p_organization_id is not null and not public.is_organization_member(p_organization_id,true) then raise exception 'organization manager required'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select id into result from public.referral_codes where owner_user_id=auth.uid() and referral_type=p_referral_type and organization_id is not distinct from p_organization_id limit 1;
 if result is not null then return result; end if;
 insert into public.referral_codes(owner_user_id,organization_id,referral_type) values(auth.uid(),p_organization_id,p_referral_type) returning id into result;
 insert into public.referral_events(referral_code_id,status) values(result,'referral_created');
 return result;
end; $$;
create function public.redeem_referral_code(p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare code_id uuid; result uuid;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select id into code_id from public.referral_codes where code=p_code and owner_user_id<>auth.uid();
 if code_id is null then raise exception 'valid referral code required'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select id into result from public.referral_events where referred_user_id=auth.uid() and status='signup';
 if result is not null then return result; end if;
 insert into public.referral_events(referral_code_id,referred_user_id,status) values(code_id,auth.uid(),'signup') returning id into result;
 return result;
end; $$;
create function public.admin_review_referral(p_referral_code_id uuid,p_referred_user_id uuid,p_status text,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.current_user_has_role('admin') then raise exception 'admin role required'; end if;
 if p_status is null or p_status not in ('qualified_activity','reward_pending','reward_approved','reward_rejected') or nullif(trim(p_note),'') is null then raise exception 'review status and note required'; end if;
 if not exists(select 1 from public.referral_events where referral_code_id=p_referral_code_id and referred_user_id=p_referred_user_id and status='signup') then raise exception 'referral signup required'; end if;
 insert into public.referral_events(referral_code_id,referred_user_id,status,note) values(p_referral_code_id,p_referred_user_id,p_status,left(p_note,2000)) returning id into result;
 perform public.audit_product_action('referral_reviewed','referral',p_referral_code_id,jsonb_build_object('status',p_status));
 return result;
end; $$;
create function public.record_mock_payment_event(p_ride_request_id uuid,p_event_id text,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; previous text; existing_ride uuid;
begin
 if not (public.current_user_has_role('admin') or auth.role()='service_role') then raise exception 'trusted payment processor required'; end if;
 if not exists(select 1 from public.app_config where id and demo_mode and mock_payment_enabled) then raise exception 'mock payment requires explicit demo configuration'; end if;
 if p_event_id is null or length(p_event_id) not between 1 and 200 or p_status is null or p_status not in ('pending','paid','failed','refunded') then raise exception 'valid event required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('payment:'||p_event_id,2));
 select e.payment_id,p.ride_request_id into result,existing_ride from public.payment_events e join public.payments p on p.id=e.payment_id where e.provider_event_id=p_event_id;
 if result is not null then
  if existing_ride<>p_ride_request_id or not exists(select 1 from public.payment_events where provider_event_id=p_event_id and status=p_status) then raise exception 'event id conflict'; end if;
  return result;
 end if;
 perform 1 from public.ride_requests where id=p_ride_request_id and status not in ('draft','passenger_cancelled','driver_cancelled','operator_cancelled','expired','no_driver_found','no_show') for update;
 if not found then raise exception 'payable ride required'; end if;
 insert into public.payments(ride_request_id,provider,status,amount) select id,'mock','pending',gross_fare from public.ride_requests where id=p_ride_request_id on conflict(ride_request_id) do nothing;
 select id,status into result,previous from public.payments where ride_request_id=p_ride_request_id for update;
 if not ((previous='pending' and p_status in ('pending','paid','failed')) or (previous='failed' and p_status='pending') or (previous='paid' and p_status='refunded')) then raise exception 'invalid payment transition'; end if;
 update public.payments set provider='mock',status=p_status,updated_at=now() where id=result;
 insert into public.payment_events(payment_id,provider_event_id,status) values(result,p_event_id,p_status);
 perform public.audit_product_action('mock_payment_'||p_status,'payment',result,jsonb_build_object('DEMO_PAYMENT',true));
 return result;
end; $$;

-- Organization ownership does not escalate the platform user_role.
-- Existing dispatch functions use this narrowly scoped predicate in the follow-on definitions below.
create function public.get_fleet_resources(p_organization_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare fleet uuid; result jsonb;
begin
 if not (public.is_organization_member(p_organization_id,true) or public.current_user_is_operations()) then raise exception 'fleet manager required'; end if;
 select fleet_id into fleet from public.organizations where id=p_organization_id and kind='fleet';
 if fleet is null then raise exception 'fleet organization required'; end if;
 select jsonb_build_object('vehicles',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'plate_number',v.plate_number,'vehicle_type',v.vehicle_type,'brand',v.brand,'model',v.model,'capacity',v.capacity,'verified',v.verified,'active',v.active)) from public.vehicles v where v.fleet_id=fleet),'[]'::jsonb),'drivers',coalesce((select jsonb_agg(data) from (select distinct jsonb_build_object('id',d.id,'user_id',d.user_id,'name',concat_ws(' ',p.first_name,p.last_name),'verification_status',d.verification_status,'online',d.online,'rating',d.rating,'rating_count',d.rating_count) data from public.driver_profiles d join public.driver_vehicles dv on dv.driver_id=d.id and dv.active join public.vehicles v on v.id=dv.vehicle_id join public.profiles p on p.id=d.user_id where v.fleet_id=fleet) rows),'[]'::jsonb)) into result;
 return result;
end; $$;
create function public.admin_link_fleet_vehicle(p_organization_id uuid,p_vehicle_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare fleet uuid;
begin
 if not public.current_user_is_operations() then raise exception 'operations role required'; end if;
 select fleet_id into fleet from public.organizations where id=p_organization_id and kind='fleet';
 if fleet is null then raise exception 'fleet organization required'; end if;
 update public.vehicles set fleet_id=fleet where id=p_vehicle_id;
 if not found then raise exception 'vehicle not found'; end if;
 perform public.audit_product_action('fleet_vehicle_linked','organization',p_organization_id,jsonb_build_object('vehicle_id',p_vehicle_id));
end; $$;

-- New tables default closed; SELECT policies are explicit, writes only through the RPCs above.
do $$ declare table_name text; begin
 foreach table_name in array array['app_config','audit_events','organizations','organization_members','organization_locations','subscription_plans','organization_subscriptions','driver_preferences','backup_assignments','ride_messages','ride_message_reads','notifications','safety_reports','emergency_contacts','referral_codes','referral_events','payments','payment_events'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('revoke all on table public.%I from anon, authenticated',table_name);
  execute format('grant select on table public.%I to authenticated',table_name);
 end loop;
end $$;
create policy app_config_read on public.app_config for select to authenticated using(true);
create policy plans_read on public.subscription_plans for select to authenticated using(active or public.current_user_is_operations());
create policy audit_operations_read on public.audit_events for select to authenticated using(public.current_user_is_operations());
create policy organizations_member_read on public.organizations for select to authenticated using(public.is_organization_member(id) or public.current_user_is_operations());
create policy organization_members_member_read on public.organization_members for select to authenticated using(user_id=auth.uid() or public.is_organization_member(organization_id,true) or public.current_user_is_operations());
create policy organization_locations_member_read on public.organization_locations for select to authenticated using(public.is_organization_member(organization_id) or public.current_user_is_operations());
create policy subscriptions_member_read on public.organization_subscriptions for select to authenticated using(public.is_organization_member(organization_id) or public.current_user_is_operations());
create policy preferences_owner_read on public.driver_preferences for select to authenticated using(exists(select 1 from public.driver_profiles where id=driver_id and user_id=auth.uid()) or public.current_user_is_operations());
create policy backup_participants_read on public.backup_assignments for select to authenticated using(public.current_user_can_read_ride(ride_request_id));
create policy messages_participants_read on public.ride_messages for select to authenticated using(public.is_ride_participant(ride_request_id) or public.current_user_is_operations());
create policy reads_participants_read on public.ride_message_reads for select to authenticated using(public.is_ride_participant(ride_request_id));
create policy notifications_owner_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy safety_report_owner_operations_read on public.safety_reports for select to authenticated using(reporter_user_id=auth.uid() or public.current_user_is_operations());
create policy emergency_contacts_owner_read on public.emergency_contacts for select to authenticated using(user_id=auth.uid());
create policy referral_codes_owner_read on public.referral_codes for select to authenticated using(owner_user_id=auth.uid() or public.is_organization_member(organization_id,true) or public.current_user_is_operations());
create policy referral_events_owner_read on public.referral_events for select to authenticated using(referred_user_id=auth.uid() or public.current_user_is_operations() or exists(select 1 from public.referral_codes c where c.id=referral_code_id and (c.owner_user_id=auth.uid() or public.is_organization_member(c.organization_id,true))));
create policy payments_participants_read on public.payments for select to authenticated using(public.is_ride_participant(ride_request_id) or public.current_user_is_operations() or exists(select 1 from public.ride_requests r where r.id=ride_request_id and public.is_organization_member(r.organization_id,true)));
create policy payment_events_operations_read on public.payment_events for select to authenticated using(public.current_user_is_operations());
create policy operations_profiles_read on public.profiles for select to authenticated using(public.current_user_is_operations());
create policy operations_drivers_read on public.driver_profiles for select to authenticated using(public.current_user_is_operations());
create policy operations_vehicles_read on public.vehicles for select to authenticated using(public.current_user_is_operations());
create policy operations_vehicle_links_read on public.driver_vehicles for select to authenticated using(public.current_user_is_operations());
create policy fleets_owner_operations_read on public.fleets for select to authenticated using(owner_user_id=auth.uid() or public.current_user_is_operations());
create policy trip_participants_read on public.trips for select to authenticated using(public.is_ride_participant(ride_request_id) or public.current_user_is_operations() or exists(select 1 from public.ride_requests r where r.id=ride_request_id and public.is_organization_member(r.organization_id,true)));
revoke all on public.trips from anon,authenticated;
grant select(id,ride_request_id,driver_id,passenger_id,vehicle_id,started_at,completed_at,actual_distance_meters,actual_duration_seconds,final_fare,created_at,gross_fare,platform_commission,driver_earnings) on public.trips to authenticated;
revoke insert,update,delete on public.fleets from anon,authenticated;
grant select on public.fleets to authenticated;

-- No public execution inheritance: internal triggers/helpers never become callable through PostgREST.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
 'is_organization_member','is_ride_participant','current_user_can_dispatch','save_driver_preferences','publish_driver_location','create_transport_request','get_passenger_trip_pin','advance_trip','confirm_ride_assignment','decline_ride_offer','get_assigned_driver','send_ride_message','mark_ride_messages_read','mark_notification_read','report_ride_safety','admin_resolve_safety_report','save_emergency_contact','delete_emergency_contact','create_organization','save_organization_member','save_organization_location','admin_manage_subscription','admin_update_config','admin_review_driver','admin_set_backup_driver','admin_activate_backup','create_referral_code','redeem_referral_code','admin_review_referral','record_mock_payment_event','get_fleet_resources','admin_link_fleet_vehicle']) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['snapshot_ride_fare','enforce_ride_transition','guard_assignment','initialize_assigned_trip']) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.record_mock_payment_event(uuid,text,text) to service_role;

-- Realtime authorization still applies through each table's SELECT policies.
do $$ declare target text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach target in array array['ride_requests','ride_offers','ride_assignments','ride_messages','notifications'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=target) then execute format('alter publication supabase_realtime add table public.%I',target); end if;
  end loop;
 end if;
end $$;
notify pgrst,'reload schema';

create or replace function public.create_ride_offers(
  p_ride_request_id uuid,
  p_radius_meters integer default null,
  p_offer_seconds integer default null,
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
  if not public.current_user_can_dispatch_ride(p_ride_request_id) then
    raise exception 'operations role required';
  end if;
  p_offer_seconds:=coalesce(p_offer_seconds,(select offer_timeout_seconds from public.app_config where id));
  p_radius_meters:=coalesce(p_radius_meters,(select default_matching_radius_km*1000 from public.app_config where id));
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
  if not public.current_user_can_dispatch_ride(p_ride_request_id) then
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


create function public.get_partner_referrals(p_organization_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not (public.is_organization_member(p_organization_id,true) or public.current_user_is_operations()) then raise exception 'partner manager required'; end if;
 if not exists(select 1 from public.organizations where id=p_organization_id and kind='partner') then raise exception 'partner organization required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'scheduled_at',r.scheduled_at,'pickup_address',r.pickup_address,'dropoff_address',r.dropoff_address,'passenger_count',r.passenger_count,'external_reference',r.external_reference,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb) into result from public.ride_requests r where r.partner_id=p_organization_id;
 return result;
end; $$;
revoke all on function public.get_partner_referrals(uuid) from public,anon,authenticated;
grant execute on function public.get_partner_referrals(uuid) to authenticated;
notify pgrst,'reload schema';

-- Explicit self-enrollment grants an unverified driver account, never privileged roles or verification.
create function public.request_driver_application() returns void language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype;
begin
 select * into p from public.profiles where id=auth.uid() for update;
 if p.id is null or p.account_status<>'active' or p.role not in ('passenger','driver') then raise exception 'active passenger or driver account required'; end if;
 if p.role='driver' then
  insert into public.driver_profiles(user_id,verification_status,online) values(p.id,'pending',false) on conflict(user_id) do nothing;
  return;
 end if;
 if exists(select 1 from public.ride_requests where passenger_id=p.id and status in ('draft','requested','searching','offered','assigned','driver_en_route','driver_arrived','trip_started')) then raise exception 'finish or cancel active passenger bookings before applying'; end if;
 update public.profiles set role='driver' where id=p.id;
 insert into public.driver_profiles(user_id,verification_status,online) values(p.id,'pending',false) on conflict(user_id) do nothing;
 perform public.audit_product_action('driver_application_requested','profile',p.id,jsonb_build_object('previous_role','passenger','verification_status','pending'));
end; $$;
revoke all on function public.request_driver_application() from public,anon,authenticated;
grant execute on function public.request_driver_application() to authenticated;
notify pgrst,'reload schema';

create function public.get_driver_reliability(p_driver_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not (public.current_user_is_operations() or exists(select 1 from public.driver_profiles where id=p_driver_id and user_id=auth.uid())) then raise exception 'driver owner or operations required'; end if;
 select jsonb_build_object('completed',count(*) filter(where r.status='trip_completed'),'cancelled',count(*) filter(where r.status='driver_cancelled'),
 'noShows',0,'onTime',count(*) filter(where arrival.at is not null and arrival.at<=coalesce(r.scheduled_at,r.created_at)+interval '5 minutes'),
 'arrivalSamples',count(arrival.at),'driverNoShowTrackingAvailable',false)
 into result from public.ride_assignments a join public.ride_requests r on r.id=a.ride_request_id
 left join lateral(select min(created_at) at from public.ride_request_events where ride_request_id=r.id and to_status='driver_arrived') arrival on true
 where a.driver_id=p_driver_id;
 -- ride_status=no_show denotes a missing passenger. Never misattribute it to driver reliability.
 return result;
end; $$;
revoke all on function public.get_driver_reliability(uuid) from public,anon,authenticated;
grant execute on function public.get_driver_reliability(uuid) to authenticated;
notify pgrst,'reload schema';
