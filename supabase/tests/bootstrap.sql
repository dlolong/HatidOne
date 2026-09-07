-- Only for the isolated Docker SQL test harness; real Supabase owns these schemas.
create schema if not exists auth;
create schema if not exists storage;
do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;
create table if not exists auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
alter table auth.users add column if not exists instance_id uuid,add column if not exists aud text,add column if not exists role text,add column if not exists encrypted_password text,add column if not exists email_confirmed_at timestamptz,add column if not exists raw_app_meta_data jsonb,add column if not exists created_at timestamptz,add column if not exists updated_at timestamptz,add column if not exists confirmation_token text,add column if not exists recovery_token text,add column if not exists email_change_token_new text,add column if not exists email_change text;
create table if not exists auth.identities(id uuid primary key,user_id uuid references auth.users(id),provider_id text,provider text,identity_data jsonb,created_at timestamptz,updated_at timestamptz,unique(provider_id,provider));
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $$;
grant usage on schema auth,storage,public to anon,authenticated,service_role;
grant execute on function auth.uid(),auth.role() to anon,authenticated,service_role;
create table if not exists storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,unique(bucket_id,name));
alter table storage.objects enable row level security;
create or replace function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
grant select,insert,update,delete on storage.objects to authenticated;
