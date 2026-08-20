-- Forward-only repair for projects that applied the initial Sprint 2 migration
-- before the trusted document-recording RPCs were added.
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

notify pgrst, 'reload schema';
