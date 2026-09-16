-- Application ownership is separate from approved-driver permissions.
-- No existing profile roles or application statuses are bulk-converted.
create or replace function public.request_driver_application() returns void
language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype; created_id uuid;
begin
 select * into p from public.profiles where id=auth.uid() for update;
 if p.id is null or p.account_status<>'active' or p.role not in ('passenger','driver') then
  raise exception 'active passenger or driver account required';
 end if;
 insert into public.driver_profiles(user_id,verification_status,online)
 values(p.id,'pending',false) on conflict(user_id) do nothing returning id into created_id;
 if created_id is not null then
  perform public.audit_product_action('driver_application_requested','profile',p.id,jsonb_build_object('verification_status','pending'));
 end if;
end; $$;

-- Serialize all applicant edits and submission with administrative review.
-- This function is private and cannot be invoked as an API privilege shortcut.
create function private.lock_driver_application() returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype; d public.driver_profiles%rowtype;
begin
 select * into p from public.profiles where id=auth.uid() for update;
 if p.id is null or p.account_status<>'active' or p.role not in ('passenger','driver') then raise exception 'active applicant required'; end if;
 select * into d from public.driver_profiles where user_id=p.id for update;
 if d.id is null then raise exception 'start driver application first'; end if;
 if d.verification_status not in ('pending','rejected') then raise exception 'onboarding is locked'; end if;
 return d.id;
end; $$;
revoke all on function private.lock_driver_application() from public,anon,authenticated;

create function public.current_user_is_driver_applicant(p_editable boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.driver_profiles d on d.user_id=p.id
 where p.id=auth.uid() and p.account_status='active' and p.role in ('passenger','driver')
 and (not p_editable or d.verification_status in ('pending','rejected')));
$$;
revoke all on function public.current_user_is_driver_applicant(boolean) from public,anon,authenticated;
grant execute on function public.current_user_is_driver_applicant(boolean) to authenticated;

-- All application writes use the locked, validated RPCs. Column-level grants
-- are revoked as well as table-level grants; stale direct-write policies confer no access.
revoke insert(user_id,preferred_area), update(preferred_area) on public.driver_profiles from authenticated;
revoke insert(owner_user_id,vehicle_type,brand,model,year,color,plate_number,capacity),
 update(vehicle_type,brand,model,year,color,plate_number,capacity) on public.vehicles from authenticated;


create or replace function public.save_driver_profile(p_phone text, p_preferred_area text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  result_id uuid;
begin
  perform private.lock_driver_application();
  if exists (
    select 1 from public.driver_profiles
    where user_id = auth.uid() and verification_status not in ('pending', 'rejected')
  ) then raise exception 'onboarding is locked'; end if;
  if nullif(trim(p_phone), '') is null or length(trim(p_phone)) > 30 then
    raise exception 'invalid phone';
  end if;
  if nullif(trim(p_preferred_area), '') is null or length(trim(p_preferred_area)) > 120 then
    raise exception 'invalid preferred area';
  end if;

  update public.profiles set phone = trim(p_phone) where id = auth.uid();
  insert into public.driver_profiles (user_id, preferred_area)
  values (auth.uid(), trim(p_preferred_area))
  on conflict (user_id) do update set preferred_area = excluded.preferred_area
  returning id into result_id;
  return result_id;
end;
$$;

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
  perform private.lock_driver_application();
  select id into current_driver_id from public.driver_profiles where user_id = auth.uid();
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
  perform private.lock_driver_application();
  if p_document_type not in ('drivers_license', 'professional_license', 'nbi_clearance', 'medical_certificate') then
    raise exception 'invalid document type';
  end if;
  if split_part(p_storage_path, '/', 1) <> auth.uid()::text then raise exception 'invalid storage path'; end if;
  select id into current_driver_id from public.driver_profiles where user_id = auth.uid();
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
  perform private.lock_driver_application();
  if p_document_type not in ('registration', 'insurance', 'franchise', 'inspection_certificate') then
    raise exception 'invalid document type';
  end if;
  if split_part(p_storage_path, '/', 1) <> auth.uid()::text then raise exception 'invalid storage path'; end if;
  if not exists (select 1 from public.vehicles v join public.driver_vehicles dv on dv.vehicle_id=v.id join public.driver_profiles d on d.id=dv.driver_id where v.id=p_vehicle_id and v.owner_user_id=auth.uid() and d.user_id=auth.uid() and dv.active) then
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

create or replace function public.submit_driver_onboarding()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  current_driver public.driver_profiles%rowtype;
begin
  -- Repeated submission is a no-op; it never resets review or approval.
  perform 1 from public.profiles where id=auth.uid() and account_status='active' and role in ('passenger','driver') for update;
  if not found then raise exception 'active applicant required'; end if;
  select * into current_driver from public.driver_profiles where user_id=auth.uid() for update;
  if current_driver.verification_status='under_review' then return; end if;
  perform private.lock_driver_application();
  if not exists(select 1 from public.profiles where id=auth.uid() and nullif(trim(first_name),'') is not null and nullif(trim(last_name),'') is not null and nullif(trim(phone),'') is not null)
    or nullif(trim(current_driver.preferred_area),'') is null then raise exception 'personal details required'; end if;
  select * into current_driver from public.driver_profiles where user_id = auth.uid() for update;
  if current_driver.id is null then raise exception 'driver profile required'; end if;
  if current_driver.verification_status not in ('pending', 'rejected') then raise exception 'onboarding cannot be submitted'; end if;
  if not exists (
    select 1 from public.driver_vehicles dv join public.vehicles v on v.id = dv.vehicle_id
    where dv.driver_id = current_driver.id and dv.is_primary and dv.active and v.owner_user_id = auth.uid()
  ) then raise exception 'primary vehicle required'; end if;
  if not exists (
    select 1 from public.driver_documents dd
    join storage.objects object on object.bucket_id = 'driver-documents'
      and object.name = dd.storage_path and object.owner_id = auth.uid()::text
    where dd.driver_id = current_driver.id and dd.document_type = 'drivers_license'
      and dd.verification_status = 'pending'
      and (dd.expires_on is null or dd.expires_on >= current_date)
  ) then raise exception 'valid pending driver license required'; end if;
  if not exists (
    select 1 from public.vehicle_documents vd
    join public.driver_vehicles dv on dv.vehicle_id = vd.vehicle_id
    join storage.objects object on object.bucket_id = 'vehicle-documents'
      and object.name = vd.storage_path and object.owner_id = auth.uid()::text
    where dv.driver_id = current_driver.id and dv.is_primary
      and vd.document_type = 'registration' and vd.verification_status = 'pending'
      and (vd.expires_on is null or vd.expires_on >= current_date)
  ) then raise exception 'valid pending vehicle registration required'; end if;
  update public.driver_profiles
  set verification_status = 'under_review', online = false
  where id = current_driver.id;
end;
$$;

create or replace function public.admin_review_driver(p_driver_id uuid,p_decision text,p_reason text default null) returns void language plpgsql security definer set search_path='' as $$
declare d public.driver_profiles%rowtype; v uuid;
begin
 if not public.current_user_is_operations() then raise exception 'operations role required'; end if;
 if p_decision is null or p_decision not in ('verified','rejected','suspended') then raise exception 'invalid decision'; end if;
 if p_decision<>'verified' and nullif(trim(p_reason),'') is null then raise exception 'review reason required'; end if;
 -- Use the same profile-before-application lock order as applicant writes.
 perform 1 from public.profiles where id=(select user_id from public.driver_profiles where id=p_driver_id) for update;
 select * into d from public.driver_profiles where id=p_driver_id for update;
 if d.id is null then raise exception 'driver not found'; end if;
 select vehicle_id into v from public.driver_vehicles where driver_id=d.id and is_primary and active;
 perform 1 from public.vehicles where id=v for update;
 if p_decision='verified' then
  if d.verification_status not in ('under_review','verified','suspended') then raise exception 'submitted application required'; end if;
  -- The existing role model reserves passenger mutations for passenger accounts.
  -- Do not strand an existing booking when granting the operational driver role.
  if exists(select 1 from public.profiles where id=d.user_id and role='passenger')
    and exists(select 1 from public.ride_requests where passenger_id=d.user_id and status in ('draft','requested','searching','offered','assigned','driver_en_route','driver_arrived','trip_started'))
    then raise exception 'finish or cancel active passenger bookings before driver approval'; end if;
  if not exists(select 1 from public.profiles where id=d.user_id and account_status='active' and role in ('passenger','driver')) then raise exception 'active eligible account required'; end if;
  if v is null then raise exception 'primary vehicle required'; end if;
  if not exists(select 1 from public.driver_documents doc join storage.objects o on o.bucket_id='driver-documents' and o.name=doc.storage_path and o.owner_id=d.user_id::text where doc.driver_id=d.id and doc.document_type='drivers_license' and (doc.expires_on is null or doc.expires_on>=current_date)) then raise exception 'valid driver license object required'; end if;
  if not exists(select 1 from public.vehicle_documents doc join storage.objects o on o.bucket_id='vehicle-documents' and o.name=doc.storage_path join public.vehicles vehicle on vehicle.id=doc.vehicle_id and o.owner_id=vehicle.owner_user_id::text where doc.vehicle_id=v and doc.document_type='registration' and (doc.expires_on is null or doc.expires_on>=current_date)) then raise exception 'valid registration object required'; end if;
 end if;
 update public.driver_documents set verification_status=p_decision::public.verification_status,reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=case when p_decision='rejected' then p_reason else null end where driver_id=d.id and document_type='drivers_license';
 update public.vehicle_documents set verification_status=p_decision::public.verification_status,reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=case when p_decision='rejected' then p_reason else null end where vehicle_id=v and document_type='registration';
 update public.vehicles set verified=(p_decision='verified') where id=v;
 update public.driver_profiles set verification_status=p_decision::public.verification_status,online=false where id=d.id;
 -- Only trusted review grants the existing operational driver role.
 if p_decision='verified' then update public.profiles set role='driver' where id=d.user_id and role='passenger'; end if;
 perform public.audit_product_action('driver_reviewed','driver',d.id,jsonb_build_object('decision',p_decision,'reason',p_reason));
 insert into public.notifications(user_id,title,body) values(d.user_id,'Driver verification updated',p_decision||coalesce(': '||p_reason,''));
end; $$;

drop policy "drivers_upload_own_private_documents" on storage.objects;
create policy "drivers_upload_own_private_documents" on storage.objects for insert to authenticated
with check(bucket_id in ('driver-documents','vehicle-documents')
 and (storage.foldername(name))[1]=auth.uid()::text
 and public.current_user_is_driver_applicant(true));
drop policy "drivers_read_own_private_documents" on storage.objects;
create policy "drivers_read_own_private_documents" on storage.objects for select to authenticated
using(bucket_id in ('driver-documents','vehicle-documents')
 and (storage.foldername(name))[1]=auth.uid()::text
 and public.current_user_is_driver_applicant(false));
drop policy "drivers_delete_unreferenced_private_documents" on storage.objects;
create policy "drivers_delete_unreferenced_private_documents" on storage.objects for delete to authenticated
using(bucket_id in ('driver-documents','vehicle-documents')
 and (storage.foldername(name))[1]=auth.uid()::text
 and public.current_user_is_driver_applicant(true)
 and not exists(select 1 from public.driver_documents where storage_path=name)
 and not exists(select 1 from public.vehicle_documents where storage_path=name));
-- Serialize booking insertion with the approval role transition. Without this
-- lock a request that checked the old role could arrive just after approval.
create function private.guard_passenger_booking_role_transition() returns trigger
language plpgsql security definer set search_path='' as $$
declare passenger public.profiles%rowtype;
begin
 select * into passenger from public.profiles where id=new.passenger_id for update;
 if new.organization_id is null and new.passenger_id=auth.uid()
   and (passenger.role<>'passenger' or passenger.account_status<>'active') then raise exception 'passenger role required'; end if;
 return new;
end; $$;
revoke all on function private.guard_passenger_booking_role_transition() from public,anon,authenticated;
create trigger ride_requests_guard_role_transition before insert on public.ride_requests
for each row execute function private.guard_passenger_booking_role_transition();
notify pgrst,'reload schema';
