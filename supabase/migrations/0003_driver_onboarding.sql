create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  document_type text not null check (document_type in ('drivers_license', 'professional_license', 'nbi_clearance', 'medical_certificate')),
  storage_path text not null,
  expires_on date,
  verification_status public.verification_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, document_type),
  check ((reviewed_at is null) = (reviewed_by is null)),
  check (verification_status <> 'rejected' or rejection_reason is not null)
);

create table public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  document_type text not null check (document_type in ('registration', 'insurance', 'franchise', 'inspection_certificate')),
  storage_path text not null,
  expires_on date,
  verification_status public.verification_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, document_type),
  check ((reviewed_at is null) = (reviewed_by is null)),
  check (verification_status <> 'rejected' or rejection_reason is not null)
);

create index driver_documents_driver_idx on public.driver_documents(driver_id, document_type);
create index driver_documents_expiry_idx on public.driver_documents(expires_on) where expires_on is not null;
create index vehicle_documents_vehicle_idx on public.vehicle_documents(vehicle_id, document_type);
create index vehicle_documents_expiry_idx on public.vehicle_documents(expires_on) where expires_on is not null;

alter table public.driver_documents enable row level security;
alter table public.vehicle_documents enable row level security;

create or replace function public.current_user_has_role(required_role public.user_role)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = required_role
      and account_status = 'active'::public.account_status
  );
$$;

revoke all on function public.current_user_has_role(public.user_role) from public;
grant execute on function public.current_user_has_role(public.user_role) to authenticated;

create policy "drivers_read_own_driver_profile"
on public.driver_profiles for select to authenticated
using (user_id = auth.uid());

create policy "drivers_create_own_driver_profile"
on public.driver_profiles for insert to authenticated
with check (user_id = auth.uid() and public.current_user_has_role('driver'));

create policy "drivers_update_own_driver_profile"
on public.driver_profiles for update to authenticated
using (user_id = auth.uid() and public.current_user_has_role('driver') and verification_status in ('pending', 'rejected'))
with check (user_id = auth.uid() and public.current_user_has_role('driver') and verification_status in ('pending', 'rejected'));

create policy "drivers_read_own_vehicles"
on public.vehicles for select to authenticated
using (owner_user_id = auth.uid());

create policy "drivers_create_own_vehicles"
on public.vehicles for insert to authenticated
with check (
  owner_user_id = auth.uid() and public.current_user_has_role('driver')
  and exists (
    select 1 from public.driver_profiles
    where user_id = auth.uid() and verification_status in ('pending', 'rejected')
  )
);

create policy "drivers_update_own_vehicles"
on public.vehicles for update to authenticated
using (
  owner_user_id = auth.uid() and public.current_user_has_role('driver')
  and exists (
    select 1 from public.driver_vehicles dv
    join public.driver_profiles dp on dp.id = dv.driver_id
    where dv.vehicle_id = vehicles.id and dp.user_id = auth.uid()
      and dp.verification_status in ('pending', 'rejected')
  )
)
with check (owner_user_id = auth.uid() and public.current_user_has_role('driver'));

create policy "drivers_read_own_vehicle_links"
on public.driver_vehicles for select to authenticated
using (
  exists (
    select 1 from public.driver_profiles
    where driver_profiles.id = driver_vehicles.driver_id
      and driver_profiles.user_id = auth.uid()
  )
);

create policy "drivers_read_own_documents"
on public.driver_documents for select to authenticated
using (
  exists (
    select 1 from public.driver_profiles
    where driver_profiles.id = driver_documents.driver_id
      and driver_profiles.user_id = auth.uid()
  )
);

create policy "drivers_create_own_documents"
on public.driver_documents for insert to authenticated
with check (
  public.current_user_has_role('driver')
  and exists (
    select 1 from public.driver_profiles
    where driver_profiles.id = driver_documents.driver_id
      and driver_profiles.user_id = auth.uid()
      and driver_profiles.verification_status in ('pending', 'rejected')
  )
  and split_part(storage_path, '/', 1) = auth.uid()::text
);

create policy "drivers_update_own_documents"
on public.driver_documents for update to authenticated
using (
  exists (
    select 1 from public.driver_profiles
    where driver_profiles.id = driver_documents.driver_id
      and driver_profiles.user_id = auth.uid()
      and driver_profiles.verification_status in ('pending', 'rejected')
  )
)
with check (
  public.current_user_has_role('driver')
  and exists (
    select 1 from public.driver_profiles
    where driver_profiles.id = driver_documents.driver_id
      and driver_profiles.user_id = auth.uid()
      and driver_profiles.verification_status in ('pending', 'rejected')
  )
  and split_part(storage_path, '/', 1) = auth.uid()::text
);

create policy "drivers_read_own_vehicle_documents"
on public.vehicle_documents for select to authenticated
using (
  exists (
    select 1 from public.vehicles
    join public.driver_vehicles dv on dv.vehicle_id = vehicles.id
    join public.driver_profiles dp on dp.id = dv.driver_id
    where vehicles.id = vehicle_documents.vehicle_id and vehicles.owner_user_id = auth.uid()
      and dp.user_id = auth.uid()
  )
);

create policy "drivers_create_own_vehicle_documents"
on public.vehicle_documents for insert to authenticated
with check (
  public.current_user_has_role('driver')
  and exists (
    select 1 from public.vehicles
    join public.driver_vehicles dv on dv.vehicle_id = vehicles.id
    join public.driver_profiles dp on dp.id = dv.driver_id
    where vehicles.id = vehicle_documents.vehicle_id and vehicles.owner_user_id = auth.uid()
      and dp.user_id = auth.uid() and dp.verification_status in ('pending', 'rejected')
  )
  and split_part(storage_path, '/', 1) = auth.uid()::text
);

create policy "drivers_update_own_vehicle_documents"
on public.vehicle_documents for update to authenticated
using (
  exists (
    select 1 from public.vehicles
    join public.driver_vehicles dv on dv.vehicle_id = vehicles.id
    join public.driver_profiles dp on dp.id = dv.driver_id
    where vehicles.id = vehicle_documents.vehicle_id and vehicles.owner_user_id = auth.uid()
      and dp.user_id = auth.uid() and dp.verification_status in ('pending', 'rejected')
  )
)
with check (
  public.current_user_has_role('driver')
  and exists (
    select 1 from public.vehicles
    join public.driver_vehicles dv on dv.vehicle_id = vehicles.id
    join public.driver_profiles dp on dp.id = dv.driver_id
    where vehicles.id = vehicle_documents.vehicle_id and vehicles.owner_user_id = auth.uid()
      and dp.user_id = auth.uid() and dp.verification_status in ('pending', 'rejected')
  )
  and split_part(storage_path, '/', 1) = auth.uid()::text
);

-- Column grants are the final barrier preventing self-verification or review.
revoke all on table public.driver_profiles from anon, authenticated;
grant select on table public.driver_profiles to authenticated;
grant insert (user_id, preferred_area) on table public.driver_profiles to authenticated;
grant update (preferred_area) on table public.driver_profiles to authenticated;

revoke all on table public.vehicles from anon, authenticated;
grant select on table public.vehicles to authenticated;
grant insert (owner_user_id, vehicle_type, brand, model, year, color, plate_number, capacity) on table public.vehicles to authenticated;
grant update (vehicle_type, brand, model, year, color, plate_number, capacity) on table public.vehicles to authenticated;

revoke all on table public.driver_vehicles from anon, authenticated;
grant select on table public.driver_vehicles to authenticated;

revoke all on table public.driver_documents from anon, authenticated;
grant select on table public.driver_documents to authenticated;
grant insert (driver_id, document_type, storage_path, expires_on) on table public.driver_documents to authenticated;
grant update (storage_path, expires_on) on table public.driver_documents to authenticated;

revoke all on table public.vehicle_documents from anon, authenticated;
grant select on table public.vehicle_documents to authenticated;
grant insert (vehicle_id, document_type, storage_path, expires_on) on table public.vehicle_documents to authenticated;
grant update (storage_path, expires_on) on table public.vehicle_documents to authenticated;

create trigger driver_profiles_set_updated_at
  before update on public.driver_profiles
  for each row execute procedure public.set_updated_at();
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute procedure public.set_updated_at();
create trigger driver_documents_set_updated_at
  before update on public.driver_documents
  for each row execute procedure public.set_updated_at();
create trigger vehicle_documents_set_updated_at
  before update on public.vehicle_documents
  for each row execute procedure public.set_updated_at();

create or replace function public.save_driver_profile(p_phone text, p_preferred_area text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  result_id uuid;
begin
  if not public.current_user_has_role('driver') then
    raise exception 'driver role required';
  end if;
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

revoke all on function public.save_driver_profile(text, text) from public;
grant execute on function public.save_driver_profile(text, text) to authenticated;

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
  if p_vehicle_type not in ('sedan', 'suv', 'van', 'motorcycle') then raise exception 'invalid vehicle type'; end if;
  if nullif(trim(p_brand), '') is null or nullif(trim(p_model), '') is null then raise exception 'brand and model required'; end if;
  if p_year < 1990 or p_year > extract(year from now())::integer + 1 then raise exception 'invalid year'; end if;
  if nullif(trim(p_color), '') is null or nullif(trim(p_plate_number), '') is null then raise exception 'color and plate required'; end if;
  if p_capacity < 1 or p_capacity > 30 then raise exception 'invalid capacity'; end if;

  if p_vehicle_id is null then
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
    select 1 from public.driver_documents
    where driver_id = current_driver.id and document_type = 'drivers_license'
      and (expires_on is null or expires_on >= current_date)
  ) then raise exception 'valid driver license required'; end if;
  if not exists (
    select 1 from public.vehicle_documents vd
    join public.driver_vehicles dv on dv.vehicle_id = vd.vehicle_id
    where dv.driver_id = current_driver.id and dv.is_primary
      and vd.document_type = 'registration'
      and (vd.expires_on is null or vd.expires_on >= current_date)
  ) then raise exception 'valid vehicle registration required'; end if;
  update public.driver_profiles
  set verification_status = 'under_review', online = false
  where id = current_driver.id;
end;
$$;

revoke all on function public.submit_driver_onboarding() from public;
grant execute on function public.submit_driver_onboarding() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('driver-documents', 'driver-documents', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png']),
  ('vehicle-documents', 'vehicle-documents', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "drivers_upload_own_private_documents"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('driver-documents', 'vehicle-documents')
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_user_has_role('driver')
);

create policy "drivers_read_own_private_documents"
on storage.objects for select to authenticated
using (
  bucket_id in ('driver-documents', 'vehicle-documents')
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_user_has_role('driver')
);

create policy "drivers_delete_own_private_documents"
on storage.objects for delete to authenticated
using (
  bucket_id in ('driver-documents', 'vehicle-documents')
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_user_has_role('driver')
);
