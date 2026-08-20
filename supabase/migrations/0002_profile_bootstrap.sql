-- Profiles are created by a trusted Auth trigger. Public signup metadata is
-- deliberately limited to display fields; role and account status are fixed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    role,
    first_name,
    last_name,
    email,
    account_status
  )
  values (
    new.id,
    'passenger'::public.user_role,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    new.email,
    'active'::public.account_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill development users created before this trigger was installed.
insert into public.profiles (id, role, first_name, last_name, email, account_status)
select
  users.id,
  'passenger'::public.user_role,
  nullif(trim(users.raw_user_meta_data ->> 'first_name'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'last_name'), ''),
  users.email,
  'active'::public.account_status
from auth.users as users
on conflict (id) do nothing;

-- The 0001 self-update policy is intentionally constrained with column grants.
-- Authenticated users cannot write role, status, verification, or audit fields.
revoke insert on table public.profiles from anon, authenticated;
revoke update on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (first_name, last_name, phone, avatar_url) on table public.profiles to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
