-- Client-owned ride rows may be read through RLS, but all lifecycle and
-- financial writes must use trusted server/database functions.
revoke all on table public.ride_requests from anon, authenticated;
grant select on table public.ride_requests to authenticated;

-- Document metadata is RPC-only. This prevents clients from bypassing review
-- resets or directly replacing a reviewed document path.
revoke all on table public.driver_documents from anon, authenticated;
grant select on table public.driver_documents to authenticated;
revoke all on table public.vehicle_documents from anon, authenticated;
grant select on table public.vehicle_documents to authenticated;

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

drop policy if exists "operations_read_driver_document_metadata" on public.driver_documents;
create policy "operations_read_driver_document_metadata"
on public.driver_documents for select to authenticated
using (public.current_user_is_operations());

drop policy if exists "operations_read_vehicle_document_metadata" on public.vehicle_documents;
create policy "operations_read_vehicle_document_metadata"
on public.vehicle_documents for select to authenticated
using (public.current_user_is_operations());

create or replace function public.verify_private_document_object()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  expected_owner uuid;
  expected_bucket text;
begin
  if tg_op = 'UPDATE' and new.storage_path is not distinct from old.storage_path then
    return new;
  end if;

  if tg_table_name = 'driver_documents' then
    expected_bucket := 'driver-documents';
    select user_id into expected_owner from public.driver_profiles where id = new.driver_id;
  elsif tg_table_name = 'vehicle_documents' then
    expected_bucket := 'vehicle-documents';
    select owner_user_id into expected_owner from public.vehicles where id = new.vehicle_id;
  else
    raise exception 'unsupported document table';
  end if;

  if expected_owner is null or split_part(new.storage_path, '/', 1) <> expected_owner::text then
    raise exception 'document path does not match owner';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = expected_bucket
      and name = new.storage_path
      and owner_id = expected_owner::text
  ) then
    raise exception 'private document object not found';
  end if;
  return new;
end;
$$;

revoke all on function public.verify_private_document_object() from public;

drop trigger if exists driver_documents_verify_object on public.driver_documents;
create trigger driver_documents_verify_object
  before insert or update of storage_path on public.driver_documents
  for each row execute procedure public.verify_private_document_object();

drop trigger if exists vehicle_documents_verify_object on public.vehicle_documents;
create trigger vehicle_documents_verify_object
  before insert or update of storage_path on public.vehicle_documents
  for each row execute procedure public.verify_private_document_object();

-- Drivers may clean up orphaned uploads while onboarding is editable. They
-- cannot delete an object referenced by document metadata.
drop policy if exists "drivers_delete_own_private_documents" on storage.objects;
create policy "drivers_delete_unreferenced_private_documents"
on storage.objects for delete to authenticated
using (
  bucket_id in ('driver-documents', 'vehicle-documents')
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_user_has_role('driver')
  and exists (
    select 1 from public.driver_profiles
    where user_id = auth.uid() and verification_status in ('pending', 'rejected')
  )
  and not exists (
    select 1 from public.driver_documents where storage_path = name
  )
  and not exists (
    select 1 from public.vehicle_documents where storage_path = name
  )
);

create policy "operations_read_private_documents"
on storage.objects for select to authenticated
using (
  bucket_id in ('driver-documents', 'vehicle-documents')
  and public.current_user_is_operations()
);

-- Normalize legacy rows before enforcing exactly one primary vehicle link per
-- driver. The oldest link remains primary deterministically.
with ranked_primary as (
  select id, row_number() over (partition by driver_id order by id) as position
  from public.driver_vehicles
  where is_primary
)
update public.driver_vehicles
set is_primary = false
where id in (select id from ranked_primary where position > 1);

create unique index if not exists driver_vehicles_one_primary_idx
  on public.driver_vehicles(driver_id) where is_primary;

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

revoke all on function public.save_driver_vehicle(text, text, text, integer, text, text, integer, uuid) from public;
grant execute on function public.save_driver_vehicle(text, text, text, integer, text, text, integer, uuid) to authenticated;

create or replace function public.submit_driver_onboarding()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  current_driver public.driver_profiles%rowtype;
begin
  if not public.current_user_has_role('driver') then raise exception 'driver role required'; end if;
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

revoke all on function public.submit_driver_onboarding() from public;
grant execute on function public.submit_driver_onboarding() to authenticated;

notify pgrst, 'reload schema';
