-- Preflight: preserve service for older confirmed rides by refusing an unsafe live upgrade.
-- Drain these rides on the existing release first; never silently promote unreviewed old fares.
do $$ begin
 if exists(select 1 from public.ride_requests where status in ('assigned','driver_en_route','driver_arrived','trip_started')) then
  raise exception 'RC1 upgrade blocked: drain active rides using existing release before migration';
 end if;
end $$;
-- RC1 additive upgrade. No environment is inferred from browser flags or NODE_ENV.
create table private.release_environment (
 id boolean primary key default true check(id),
 environment text not null check(environment in ('pilot','production','demo','test')),
 created_at timestamptz not null default now()
);
insert into private.release_environment(id,environment) values(true,'pilot');
revoke all on private.release_environment from public,anon,authenticated,service_role;
create function public.rc1_demo_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.release_environment where id and environment in ('demo','test'))
 and exists(select 1 from public.app_config where id and demo_mode);
$$;
revoke all on function public.rc1_demo_allowed() from public,anon;
grant execute on function public.rc1_demo_allowed() to authenticated;
alter table public.app_config add column bookings_paused boolean not null default false,
 add column service_area_open boolean not null default true, add column integrations_enabled boolean not null default true;
alter table public.ride_requests alter column pickup_location drop not null, alter column dropoff_location drop not null,
 drop constraint scheduled_rides_have_schedule_and_estimate,
 add column quote_status text not null default 'pending_review' check(quote_status in ('pending_review','offered','accepted','demo')),
 add column quote_version integer not null default 0 check(quote_version>=0);
-- Existing fares are preserved for review, never silently promoted to accepted real quotes.
create table private.booking_operations (
 actor_user_id uuid not null references public.profiles(id), operation_id uuid not null,
 payload jsonb not null, ride_request_id uuid not null references public.ride_requests(id),
 created_at timestamptz not null default now(), primary key(actor_user_id,operation_id)
);
revoke all on private.booking_operations from public,anon,authenticated,service_role;
create table public.ride_quotes (
 ride_request_id uuid not null references public.ride_requests(id), version integer not null check(version>0),
 amount numeric(12,2) not null check(amount>=0), currency text not null default 'PHP' check(currency='PHP'),
 breakdown jsonb not null check(jsonb_typeof(breakdown)='object'), reason text not null check(length(trim(reason)) between 3 and 2000),
 duration_seconds integer not null check(duration_seconds between 60 and 86400), actor_user_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), primary key(ride_request_id,version)
);
alter table public.ride_quotes enable row level security;
revoke all on public.ride_quotes from public,anon,authenticated;
grant select on public.ride_quotes to authenticated;
create policy quotes_authorized_read on public.ride_quotes for select to authenticated using(public.current_user_can_read_ride(ride_request_id));
create table public.cash_collection_events (
 id uuid primary key default gen_random_uuid(), ride_request_id uuid not null references public.ride_requests(id),
 actor_user_id uuid not null references public.profiles(id), operation_id uuid not null,
 kind text not null check(kind in ('reported','reconciled','disputed')), amount numeric(12,2) not null check(amount>=0),
 currency text not null default 'PHP' check(currency='PHP'), note text not null check(length(trim(note)) between 3 and 2000),
 created_at timestamptz not null default now(), unique(actor_user_id,operation_id), unique(ride_request_id,kind)
);
create index cash_collection_events_ride_idx on public.cash_collection_events(ride_request_id,created_at);
alter table public.cash_collection_events enable row level security;
revoke all on public.cash_collection_events from public,anon,authenticated;
grant select on public.cash_collection_events to authenticated;
create policy cash_authorized_read on public.cash_collection_events for select to authenticated using(public.is_ride_participant(ride_request_id) or public.current_user_is_operations());

create function public.admin_set_release_controls(p_bookings_paused boolean,p_service_area_open boolean,p_integrations_enabled boolean,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_has_role('admin') then raise exception 'admin role required'; end if;
 if p_reason is null or length(trim(p_reason)) not between 3 and 2000 then raise exception 'reason required'; end if;
 update public.app_config set bookings_paused=p_bookings_paused,service_area_open=p_service_area_open,integrations_enabled=p_integrations_enabled,updated_at=now() where id;
 perform public.audit_product_action('release_controls_updated','configuration',null,jsonb_build_object('bookings_paused',p_bookings_paused,'service_area_open',p_service_area_open,'integrations_enabled',p_integrations_enabled,'reason',p_reason));
end; $$;

-- Keep the prior demo implementation private and revoke all exposed legacy grants.
alter function public.create_transport_request(jsonb) set schema private;
revoke all on function private.create_transport_request(jsonb) from public,anon,authenticated,service_role;
create function public.create_transport_request(p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid; op private.booking_operations%rowtype; request_key uuid; scheduled timestamptz; vehicle text; seats integer; org uuid; rider uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'active account required'; end if;
 if jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>10000 then raise exception 'invalid request'; end if;
 request_key:=(p_payload->>'client_request_id')::uuid;
 if request_key is null then raise exception 'request id required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||request_key::text,9));
 select * into op from private.booking_operations where actor_user_id=auth.uid() and operation_id=request_key;
 if found then
  if op.payload<>p_payload then raise exception 'request key payload conflict'; end if;
  return op.ride_request_id;
 end if;
 perform 1 from public.app_config where id and not bookings_paused and service_area_open for share;
 if not found then raise exception 'new bookings paused or service area closed'; end if;
 if public.rc1_demo_allowed() and p_payload->>'pickup_lat' is not null and p_payload->>'pickup_lng' is not null and p_payload->>'dropoff_lat' is not null and p_payload->>'dropoff_lng' is not null then
  if exists(select 1 from public.ride_requests where passenger_id=coalesce((p_payload->>'passenger_id')::uuid,auth.uid()) and client_request_id=request_key) then raise exception 'legacy request key requires review'; end if;
  r:=private.create_transport_request(p_payload);
  update public.ride_requests set quote_status='demo' where id=r;
 else
  rider:=coalesce((p_payload->>'passenger_id')::uuid,auth.uid()); org:=(p_payload->>'organization_id')::uuid;
  if org is not null then raise exception 'organization booking is unavailable in RC1; use an invited passenger account'; end if;
  if org is null then
   if not public.current_user_has_role('passenger') or rider<>auth.uid() then raise exception 'passenger role required'; end if;
  else
   if not public.is_organization_member(org,true) then raise exception 'organization manager required'; end if;
   if rider<>auth.uid() and not exists(select 1 from public.organization_members m join public.profiles p on p.id=m.user_id where m.organization_id=org and m.user_id=rider and m.status='active' and p.account_status='active') then raise exception 'authorized organization rider required'; end if;
  end if;
  if coalesce(p_payload->>'service_type','scheduled') not in ('scheduled','transfer') then raise exception 'scheduled service only during pilot'; end if;
  if p_payload->>'scheduled_at' is null or (p_payload->>'scheduled_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'schedule requires explicit timezone'; end if;
  scheduled:=(p_payload->>'scheduled_at')::timestamptz;
  if scheduled<now()+interval '30 minutes' or scheduled>now()+interval '180 days' then raise exception 'schedule must be 30 minutes to 180 days ahead'; end if;
  if nullif(trim(p_payload->>'pickup_address'),'') is null or length(p_payload->>'pickup_address')>240 or nullif(trim(p_payload->>'dropoff_address'),'') is null or length(p_payload->>'dropoff_address')>240 then raise exception 'valid addresses required'; end if;
  if length(p_payload->>'passenger_notes')>500 then raise exception 'notes too long'; end if;
  vehicle:=p_payload->>'vehicle_type'; seats:=coalesce((p_payload->>'passenger_count')::integer,1);
  if vehicle is null or vehicle not in ('motorcycle','sedan','suv','van') or seats not between 1 and (case vehicle when 'motorcycle' then 1 when 'sedan' then 4 when 'suv' then 6 else 15 end) then raise exception 'invalid vehicle or passenger count'; end if;
  if exists(select 1 from public.ride_requests where passenger_id=rider and client_request_id=request_key) then raise exception 'legacy request key requires review'; end if;
  -- Addresses/landmarks are authoritative input for human review; no fabricated coordinates or route.
  insert into public.ride_requests(passenger_id,client_request_id,organization_id,pickup_address,dropoff_address,service_type,vehicle_type,scheduled_at,passenger_count,passenger_notes,status,route_source,route_preference,quote_status)
  values(rider,request_key,org,trim(p_payload->>'pickup_address'),trim(p_payload->>'dropoff_address'),coalesce(p_payload->>'service_type','scheduled'),vehicle,scheduled,seats,nullif(trim(p_payload->>'passenger_notes'),''),'requested','manual_review',coalesce(p_payload->>'route_preference','fastest'),'pending_review') returning id into r;
  insert into public.ride_request_events(ride_request_id,actor_user_id,event_type,to_status,metadata) values(r,auth.uid(),'created','requested','{"route_source":"manual_review","location_validation":"unavailable"}');
 end if;
 insert into private.booking_operations(actor_user_id,operation_id,payload,ride_request_id) values(auth.uid(),request_key,p_payload,r);
 return r;
end; $$;

create or replace function public.create_scheduled_ride_request(p_client_request_id uuid,p_pickup_address text,p_pickup_lat double precision,p_pickup_lng double precision,p_dropoff_address text,p_dropoff_lat double precision,p_dropoff_lng double precision,p_scheduled_at timestamptz,p_vehicle_type text,p_passenger_notes text default null)
returns uuid language sql security definer set search_path='' as $$
 select public.create_transport_request(jsonb_build_object('client_request_id',p_client_request_id,'pickup_address',p_pickup_address,'pickup_lat',p_pickup_lat,'pickup_lng',p_pickup_lng,'dropoff_address',p_dropoff_address,'dropoff_lat',p_dropoff_lat,'dropoff_lng',p_dropoff_lng,'scheduled_at',to_char(p_scheduled_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'vehicle_type',p_vehicle_type,'passenger_notes',p_passenger_notes,'service_type','scheduled','passenger_count',1));
$$;

create function public.admin_review_ride_quote(p_ride_request_id uuid,p_expected_version integer,p_amount numeric,p_duration_seconds integer,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare r public.ride_requests%rowtype; version integer;
begin
 if not public.current_user_is_operations() then raise exception 'operations role required'; end if;
 select * into r from public.ride_requests where id=p_ride_request_id for update;
 if r.id is null or r.status not in ('requested','searching','offered') or exists(select 1 from public.ride_assignments where ride_request_id=r.id) then raise exception 'unassigned request required'; end if;
 if p_expected_version is null or r.quote_version<>p_expected_version then raise exception 'quote version conflict'; end if;
 if p_amount is null or p_amount<0 or p_amount>9999999999.99 or p_amount<>round(p_amount,2) or p_duration_seconds is null or p_duration_seconds not between 60 and 86400 or p_reason is null or length(trim(p_reason)) not between 3 and 2000 then raise exception 'amount, reviewed duration and reason required'; end if;
 version:=r.quote_version+1;
 insert into public.ride_quotes(ride_request_id,version,amount,breakdown,reason,duration_seconds,actor_user_id)
 values(r.id,version,p_amount,jsonb_build_object('gross_fare',p_amount,'commission_percent',0,'platform_commission',0,'driver_earnings',p_amount,'currency','PHP','route_source','operator_review','tolls','included in reviewed total; confirm explanation'),trim(p_reason),p_duration_seconds,auth.uid());
 update public.ride_requests set quote_version=version,quote_status='offered',estimated_fare=p_amount,gross_fare=p_amount,commission_percent=0,platform_commission=0,driver_earnings=p_amount,estimated_duration_seconds=p_duration_seconds,route_source='operator_review' where id=r.id;
 update public.ride_offers set status='cancelled' where ride_request_id=r.id and status='pending';
 perform public.audit_product_action('quote_reviewed','ride',r.id,jsonb_build_object('version',version,'amount',p_amount,'duration_seconds',p_duration_seconds,'reason',p_reason));
 return version;
end; $$;
create function public.accept_ride_quote(p_ride_request_id uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare r public.ride_requests%rowtype;
begin
 if not public.current_user_has_role('passenger') then raise exception 'passenger role required'; end if;
 select * into r from public.ride_requests where id=p_ride_request_id and passenger_id=auth.uid() for update;
 if r.id is null then raise exception 'own booking required'; end if;
 if p_version is null or r.quote_version<>p_version or r.quote_status not in ('offered','accepted') then raise exception 'quote version conflict'; end if;
 if r.quote_status='accepted' then return; end if;
 if r.status not in ('requested','searching','offered') or r.scheduled_at<=now() then raise exception 'quote no longer available'; end if;
 update public.ride_requests set quote_status='accepted' where id=r.id;
 perform public.audit_product_action('quote_accepted','ride',r.id,jsonb_build_object('version',p_version));
end; $$;

create function public.record_cash_collection(p_ride_request_id uuid,p_operation_id uuid,p_kind text,p_amount numeric,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.ride_requests%rowtype; existing public.cash_collection_events%rowtype; result uuid; payment uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'active account required'; end if;
 if p_operation_id is null or p_kind is null or p_kind not in ('reported','reconciled','disputed') or p_amount is null or p_amount<0 or p_amount<>round(p_amount,2) or p_note is null or length(trim(p_note)) not between 3 and 2000 then raise exception 'valid collection event required'; end if;
 if p_kind='reported' then
  if not public.current_user_has_role('driver') or not exists(select 1 from public.ride_assignments a join public.driver_profiles d on d.id=a.driver_id where a.ride_request_id=p_ride_request_id and d.user_id=auth.uid()) then raise exception 'assigned driver required'; end if;
 elsif not public.current_user_is_operations() then raise exception 'operations role required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_operation_id::text,10));
 select * into existing from public.cash_collection_events where actor_user_id=auth.uid() and operation_id=p_operation_id;
 if found then
  if existing.ride_request_id<>p_ride_request_id or existing.kind<>p_kind or existing.amount<>p_amount or existing.note<>trim(p_note) then raise exception 'collection operation payload conflict'; end if;
  return existing.id;
 end if;
 select * into r from public.ride_requests where id=p_ride_request_id for update;
 if r.id is null or r.status<>'trip_completed' then raise exception 'completed trip required'; end if;
 if p_amount>r.gross_fare then raise exception 'collection exceeds agreed fare'; end if;
 if exists(select 1 from public.cash_collection_events where ride_request_id=r.id and kind=p_kind) then raise exception 'collection kind already recorded; operations review required'; end if;
 if p_kind='reconciled' and (p_amount<>r.gross_fare or not exists(select 1 from public.cash_collection_events where ride_request_id=r.id and kind='reported' and amount=p_amount) or exists(select 1 from public.cash_collection_events where ride_request_id=r.id and kind='disputed')) then raise exception 'matching full report and no dispute required; adjustment needs review'; end if;
 select id into payment from public.payments where ride_request_id=r.id and provider='cash' for update;
 if payment is null then raise exception 'cash payment record required'; end if;
 insert into public.cash_collection_events(ride_request_id,actor_user_id,operation_id,kind,amount,note) values(r.id,auth.uid(),p_operation_id,p_kind,p_amount,trim(p_note)) returning id into result;
 if p_kind in ('reconciled','disputed') then
  update public.payments set status=case when p_kind='reconciled' then 'paid' else 'pending' end,updated_at=now() where id=payment;
  insert into public.payment_events(payment_id,provider_event_id,status) values(payment,'cash:'||result::text,case when p_kind='reconciled' then 'paid' else 'pending' end);
 end if;
 perform public.audit_product_action('cash_'||p_kind,'ride',r.id,jsonb_build_object('event_id',result,'amount',p_amount,'currency','PHP'));
 return result;
end; $$;

create or replace function public.driver_can_take_ride(p_driver_id uuid,p_vehicle_id uuid,p_ride_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
 select 1 from public.driver_profiles d join public.profiles p on p.id=d.user_id
 join public.driver_vehicles dv on dv.driver_id=d.id and dv.vehicle_id=p_vehicle_id and dv.active
 join public.vehicles v on v.id=dv.vehicle_id join public.ride_requests r on r.id=p_ride_id
 left join public.driver_preferences pref on pref.driver_id=d.id
 where (r.quote_status='accepted' or (r.route_source='local_estimate' and public.rc1_demo_allowed())) and r.estimated_duration_seconds is not null and d.id=p_driver_id and d.verification_status='verified' and d.online and p.account_status='active' and p.role='driver'
 and v.verified and v.active and v.vehicle_type=r.vehicle_type and v.capacity>=r.passenger_count
 and (pref.driver_id is null or r.service_type=any(pref.service_types))
 and exists(select 1 from public.driver_documents doc where doc.driver_id=d.id and doc.document_type='drivers_license' and doc.verification_status='verified' and doc.expires_on>=(greatest(coalesce(r.scheduled_at,now()),now()) at time zone 'Asia/Manila')::date)
 and exists(select 1 from public.vehicle_documents doc where doc.vehicle_id=v.id and doc.document_type='registration' and doc.verification_status='verified' and doc.expires_on>=(greatest(coalesce(r.scheduled_at,now()),now()) at time zone 'Asia/Manila')::date)
 and not exists(select 1 from public.ride_assignments a join public.ride_requests other on other.id=a.ride_request_id
 where (a.driver_id=d.id or a.vehicle_id=v.id) and other.id<>r.id and other.status in ('assigned','driver_en_route','driver_arrived','trip_started')
 and tstzrange(coalesce(other.scheduled_at,other.created_at)-interval '30 minutes',coalesce(other.scheduled_at,other.created_at)+make_interval(secs=>coalesce(other.estimated_duration_seconds,3600))+interval '30 minutes','[)')
 && tstzrange(coalesce(r.scheduled_at,r.created_at),coalesce(r.scheduled_at,r.created_at)+make_interval(secs=>coalesce(r.estimated_duration_seconds,3600)),'[)'))
 );
$$;

create or replace function public.admin_update_config(p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_has_role('admin') then raise exception 'admin role required'; end if;
 if coalesce((p_payload->>'driver_commission_percent')::numeric,0)<>0 then raise exception 'RC1 commission policy is zero'; end if;
 if ((p_payload->>'demo_mode')::boolean or (p_payload->>'mock_payment_enabled')::boolean or (p_payload->>'mock_notifications_enabled')::boolean) and not exists(select 1 from private.release_environment where id and environment in ('demo','test')) then raise exception 'isolated demo environment required'; end if;
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

create or replace function public.record_mock_payment_event(p_ride_request_id uuid,p_event_id text,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; previous text; existing_ride uuid;
begin
 if not (public.current_user_has_role('admin') or auth.role()='service_role') then raise exception 'trusted payment processor required'; end if;
 if not public.rc1_demo_allowed() or not exists(select 1 from public.app_config where id and integrations_enabled and demo_mode and mock_payment_enabled) then raise exception 'mock payment requires explicit demo configuration'; end if;
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

create or replace function public.advance_trip(p_ride_request_id uuid,p_action text,p_pin text default null) returns public.ride_status
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

 if r.status=desired then
  if p_action='start' then raise exception 'PIN replay rejected; refresh authoritative trip'; end if;
  return r.status;
 end if;
 if p_action in ('heading','arrived','start') and not public.rc1_demo_allowed() then
  if not exists(select 1 from public.ride_assignments where ride_request_id=r.id and confirmed_at is not null) then raise exception 'driver reconfirmation required'; end if;
 end if;
 if p_action in ('heading','arrived','start') and not exists(select 1 from public.ride_assignments a where a.ride_request_id=r.id and public.driver_can_take_ride(a.driver_id,a.vehicle_id,r.id)) then raise exception 'driver, documents, vehicle or schedule no longer eligible'; end if;
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

create or replace function public.confirm_ride_assignment(p_ride_request_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
 perform 1 from public.ride_requests where id=p_ride_request_id and status in ('assigned','driver_en_route','driver_arrived') for update;
 if not found then raise exception 'active assignment required'; end if;
 if not exists(select 1 from public.ride_assignments a join public.driver_profiles d on d.id=a.driver_id where a.ride_request_id=p_ride_request_id and d.user_id=auth.uid() and public.driver_can_take_ride(a.driver_id,a.vehicle_id,p_ride_request_id)) then raise exception 'assigned eligible driver required'; end if;
 update public.ride_assignments set confirmed_at=coalesce(confirmed_at,now()) where ride_request_id=p_ride_request_id and driver_id in (select id from public.driver_profiles where user_id=auth.uid());
 if not found then raise exception 'assigned driver required'; end if;
 perform public.audit_product_action('driver_reconfirmed','ride',p_ride_request_id);
end; $$;

create or replace function public.get_assigned_driver(p_ride_request_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not (public.is_ride_participant(p_ride_request_id) or public.current_user_is_operations()) then raise exception 'trip participant required'; end if;
 select jsonb_build_object('confirmed_at',a.confirmed_at,'driver_id',d.id,'name',concat_ws(' ',p.first_name,p.last_name),'verification_status',d.verification_status,'rating',d.rating,'rating_count',d.rating_count,'vehicle_type',v.vehicle_type,'brand',v.brand,'model',v.model,'color',v.color,'plate_number',v.plate_number,'capacity',v.capacity)
 into result from public.ride_assignments a join public.driver_profiles d on d.id=a.driver_id join public.profiles p on p.id=d.user_id join public.vehicles v on v.id=a.vehicle_id where a.ride_request_id=p_ride_request_id;
 return result;
end; $$;

-- Quote-only demo API is not usable as an authoritative fare provider in a real environment.
alter function public.placeholder_scheduled_fare(double precision,double precision,double precision,double precision,text) set schema private;
revoke all on function private.placeholder_scheduled_fare(double precision,double precision,double precision,double precision,text) from public,anon,authenticated,service_role;
create function public.placeholder_scheduled_fare(p_pickup_lat double precision,p_pickup_lng double precision,p_dropoff_lat double precision,p_dropoff_lng double precision,p_vehicle_type text)
returns table(distance_meters integer,duration_seconds integer,estimated_fare numeric(12,2)) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.rc1_demo_allowed() then raise exception 'manual quote review required; simulated fares disabled'; end if;
 return query select * from private.placeholder_scheduled_fare(p_pickup_lat,p_pickup_lng,p_dropoff_lat,p_dropoff_lng,p_vehicle_type);
end; $$;

-- For address-only manually reviewed requests, eligibility does not invent a pickup distance.
alter function public.find_eligible_drivers(uuid,integer,integer) set schema private;
revoke all on function private.find_eligible_drivers(uuid,integer,integer) from public,anon,authenticated,service_role;
create function public.find_eligible_drivers(p_ride_request_id uuid,p_radius_meters integer default null,p_limit integer default 20)
returns table(driver_id uuid,vehicle_id uuid,driver_user_id uuid,distance_meters integer) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.current_user_can_dispatch_ride(p_ride_request_id) then raise exception 'operations role required'; end if;
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid search limit'; end if;
 if exists(select 1 from public.ride_requests where id=p_ride_request_id and route_source='operator_review') then
  return query select distinct on(d.id) d.id,v.id,d.user_id,null::integer
  from public.driver_profiles d join public.driver_vehicles dv on dv.driver_id=d.id and dv.active join public.vehicles v on v.id=dv.vehicle_id
  where public.driver_can_take_ride(d.id,v.id,p_ride_request_id)
  and (public.current_user_is_operations() or exists(select 1 from public.fleets f where f.id=v.fleet_id and f.owner_user_id=auth.uid()))
  order by d.id,dv.is_primary desc,v.id limit p_limit;
 else
  return query select * from private.find_eligible_drivers(p_ride_request_id,p_radius_meters,p_limit);
 end if;
end; $$;

-- The old endpoint remains for isolated demos; all real assignments need a reason/version.
alter function public.manual_assign_ride(uuid,uuid,uuid,integer) set schema private;
revoke all on function private.manual_assign_ride(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
create function public.manual_assign_ride(p_ride_request_id uuid,p_driver_id uuid,p_vehicle_id uuid,p_radius_meters integer default 100000)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not public.rc1_demo_allowed() then raise exception 'use versioned manual assignment with reason'; end if;
 return private.manual_assign_ride(p_ride_request_id,p_driver_id,p_vehicle_id,p_radius_meters);
end; $$;
create function public.rc1_manual_assign_ride(p_ride_request_id uuid,p_driver_id uuid,p_vehicle_id uuid,p_expected_version integer,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.ride_requests%rowtype; result uuid;
begin
 if not public.current_user_can_dispatch_ride(p_ride_request_id) then raise exception 'operations role required'; end if;
 if p_reason is null or length(trim(p_reason)) not between 3 and 2000 then raise exception 'assignment reason required'; end if;
 select * into r from public.ride_requests where id=p_ride_request_id for update;
 if p_expected_version is null or r.quote_version<>p_expected_version then raise exception 'quote version conflict'; end if;
 if r.id is null or r.status not in ('requested','searching','offered') then raise exception 'ride cannot be assigned; refresh authoritative state'; end if;
 if r.scheduled_at<=now() then raise exception 'schedule has passed; new reviewed request required'; end if;
 result:=private.manual_assign_ride(p_ride_request_id,p_driver_id,p_vehicle_id,100000);
 perform public.audit_product_action('rc1_manual_assignment','ride',r.id,jsonb_build_object('assignment_id',result,'quote_version',p_expected_version,'reason',trim(p_reason)));
 return result;
end; $$;

-- Offer id is a durable operation identifier: lost-response replay returns the same assignment.
alter function public.accept_ride_offer(uuid) set schema private;
revoke all on function private.accept_ride_offer(uuid) from public,anon,authenticated,service_role;
create function public.accept_ride_offer(p_offer_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid; result uuid;
begin
 if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
 select o.ride_request_id into r from public.ride_offers o join public.driver_profiles d on d.id=o.driver_id where o.id=p_offer_id and d.user_id=auth.uid();
 if r is null then raise exception 'offer not found'; end if;
 perform 1 from public.ride_requests where id=r for update;
 select a.id into result from public.ride_assignments a join public.ride_offers o on o.ride_request_id=a.ride_request_id and o.driver_id=a.driver_id and o.vehicle_id=a.vehicle_id where o.id=p_offer_id and o.status='accepted';
 if result is not null then return result; end if;
 if exists(select 1 from public.ride_offers where id=p_offer_id and status='pending' and expires_at<=clock_timestamp()) then raise exception 'offer expired'; end if;
 return private.accept_ride_offer(p_offer_id);
end; $$;

-- Integrations switch affects optional dispatch offers, never existing confirmed trip actions.
alter function public.create_ride_offers(uuid,integer,integer,integer) set schema private;
revoke all on function private.create_ride_offers(uuid,integer,integer,integer) from public,anon,authenticated,service_role;
create function public.create_ride_offers(p_ride_request_id uuid,p_radius_meters integer default null,p_offer_seconds integer default null,p_limit integer default 20)
returns integer language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.app_config where id and integrations_enabled) then raise exception 'offer integration disabled; use manual dispatch'; end if;
 return private.create_ride_offers(p_ride_request_id,p_radius_meters,p_offer_seconds,p_limit);
end; $$;

-- PIN/account access must still be active, even when the auth token has not yet expired.
alter function public.get_passenger_trip_pin(uuid) set schema private;
revoke all on function private.get_passenger_trip_pin(uuid) from public,anon,authenticated,service_role;
create function public.get_passenger_trip_pin(p_ride_request_id uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_has_role('passenger') then raise exception 'active passenger required'; end if;
 return private.get_passenger_trip_pin(p_ride_request_id);
end; $$;

-- Do not permit entry points to modify immutable accepted financial snapshots after assignment.
create function private.guard_accepted_fare() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.ride_assignments where ride_request_id=old.id) and
 (new.gross_fare,new.commission_percent,new.platform_commission,new.driver_earnings,new.estimated_fare,new.quote_version,new.estimated_duration_seconds,new.scheduled_at)
 is distinct from (old.gross_fare,old.commission_percent,old.platform_commission,old.driver_earnings,old.estimated_fare,old.quote_version,old.estimated_duration_seconds,old.scheduled_at)
 then raise exception 'assigned fare and schedule are immutable'; end if;
 return new;
end; $$;
revoke all on function private.guard_accepted_fare() from public,anon,authenticated,service_role;
create trigger guard_accepted_fare before update on public.ride_requests for each row execute function private.guard_accepted_fare();

-- Migration-owned API allowlist. Private legacy implementation functions stay inaccessible.
do $$ declare f record; begin
 for f in select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=any(array['create_transport_request','create_scheduled_ride_request','placeholder_scheduled_fare','admin_set_release_controls','admin_review_ride_quote','accept_ride_quote','record_cash_collection','rc1_manual_assign_ride','manual_assign_ride','find_eligible_drivers','accept_ride_offer','create_ride_offers','get_passenger_trip_pin']) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
notify pgrst,'reload schema';

-- Preserve demo backup functionality while disabling unversioned reassignment in real data.
alter function public.admin_activate_backup(uuid) set schema private;
revoke all on function private.admin_activate_backup(uuid) from public,anon,authenticated,service_role;
create function public.admin_activate_backup(p_ride_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not public.rc1_demo_allowed() then raise exception 'real reassignment requires reviewed recovery; contact operations'; end if;
 return private.admin_activate_backup(p_ride_request_id);
end; $$;
revoke all on function public.admin_activate_backup(uuid) from public,anon;
grant execute on function public.admin_activate_backup(uuid) to authenticated;
notify pgrst,'reload schema';


-- Review requests are safe to collect before a retention/deletion policy is approved.
-- This endpoint does not erase Auth users or financial/audit records.
create table public.account_deletion_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 status text not null default 'requested' check(status in ('requested','in_review','completed')),
 reason text not null check(length(trim(reason)) between 3 and 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index account_deletion_one_open on public.account_deletion_requests(user_id) where status in ('requested','in_review');
create index account_deletion_queue_idx on public.account_deletion_requests(status,created_at);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant select on public.account_deletion_requests to authenticated;
create policy deletion_requests_owner_operations on public.account_deletion_requests for select to authenticated using(user_id=auth.uid() or public.current_user_is_operations());
create function public.request_account_deletion(p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'authenticated account required'; end if;
 if p_reason is null or length(trim(p_reason)) not between 3 and 2000 then raise exception 'request reason required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,11));
 select id into result from public.account_deletion_requests where user_id=auth.uid() and status in ('requested','in_review');
 if result is not null then return result; end if;
 insert into public.account_deletion_requests(user_id,reason) values(auth.uid(),trim(p_reason)) returning id into result;
 perform public.audit_product_action('account_deletion_requested','account',auth.uid(),jsonb_build_object('request_id',result));
 return result;
end; $$;
revoke all on function public.request_account_deletion(text) from public,anon;
grant execute on function public.request_account_deletion(text) to authenticated;
notify pgrst,'reload schema';

-- Explicitly reviewed reassignment is available only before the driver heads to pickup.
alter table public.ride_assignments add column assignment_version integer not null default 1 check(assignment_version>0);
create function public.rc1_reassign_ride(p_ride_request_id uuid,p_driver_id uuid,p_vehicle_id uuid,p_expected_assignment_version integer,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare r public.ride_requests%rowtype; a public.ride_assignments%rowtype; version integer;
begin
 if not public.current_user_can_dispatch_ride(p_ride_request_id) then raise exception 'operations role required'; end if;
 if p_reason is null or length(trim(p_reason)) not between 3 and 2000 then raise exception 'reassignment reason required'; end if;
 select * into r from public.ride_requests where id=p_ride_request_id for update;
 if r.id is null or r.status<>'assigned' then raise exception 'reassignment only allowed before heading to pickup'; end if;
 select * into a from public.ride_assignments where ride_request_id=r.id for update;
 if a.id is null or p_expected_assignment_version is null or a.assignment_version<>p_expected_assignment_version then raise exception 'assignment version conflict'; end if;
 if a.driver_id=p_driver_id and a.vehicle_id=p_vehicle_id then raise exception 'choose a different driver or vehicle'; end if;
 if not exists(select 1 from public.find_eligible_drivers(r.id,100000,100) e where e.driver_id=p_driver_id and e.vehicle_id=p_vehicle_id) then raise exception 'replacement driver is not eligible'; end if;
 -- Assignment triggers serialize driver/vehicle eligibility, forbid started trips, and rotate PIN.
 version:=a.assignment_version+1;
 update public.ride_assignments set driver_id=p_driver_id,vehicle_id=p_vehicle_id,fleet_id=(select fleet_id from public.vehicles where id=p_vehicle_id),
 assignment_type=case when public.current_user_is_operations() then 'admin' else 'fleet' end,assigned_at=now(),confirmed_at=null,assignment_version=version where id=a.id;
 update public.ride_offers set status='cancelled' where ride_request_id=r.id and status in ('pending','accepted');
 update public.backup_assignments set status='cancelled' where ride_request_id=r.id;
 perform public.audit_product_action('rc1_reassignment','ride',r.id,jsonb_build_object('assignment_version',version,'previous_driver_id',a.driver_id,'driver_id',p_driver_id,'vehicle_id',p_vehicle_id,'reason',trim(p_reason)));
 insert into public.notifications(user_id,title,body,ride_request_id) select user_id,'Assignment changed','Operations reassigned this ride. Refresh your current assignments.',r.id from public.driver_profiles where id=a.driver_id;
 insert into public.notifications(user_id,title,body,ride_request_id) select user_id,'Reconfirmation required','Operations assigned this scheduled ride to you. Review and reconfirm in app.',r.id from public.driver_profiles where id=p_driver_id;
 insert into public.notifications(user_id,title,body,ride_request_id) values(r.passenger_id,'Driver assignment changed','Review the updated driver. Reconfirmation is pending.',r.id);
 return version;
end; $$;
revoke all on function public.rc1_reassign_ride(uuid,uuid,uuid,integer,text) from public,anon;
grant execute on function public.rc1_reassign_ride(uuid,uuid,uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
