create extension if not exists pgcrypto;
create extension if not exists postgis;

create type public.user_role as enum ('passenger','driver','fleet_admin','admin','support');
create type public.account_status as enum ('pending','active','suspended','banned');
create type public.verification_status as enum ('pending','under_review','verified','rejected','suspended');
create type public.ride_status as enum (
  'draft','requested','searching','offered','assigned','driver_en_route','driver_arrived','trip_started','trip_completed',
  'passenger_cancelled','driver_cancelled','operator_cancelled','expired','no_driver_found','no_show'
);
create type public.ride_offer_status as enum ('pending','accepted','declined','expired','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'passenger',
  first_name text,
  last_name text,
  phone text,
  email text,
  avatar_url text,
  phone_verified boolean not null default false,
  account_status public.account_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  verification_status public.verification_status not null default 'pending',
  rating numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  acceptance_rate numeric(5,2) not null default 0,
  cancellation_rate numeric(5,2) not null default 0,
  trust_score integer not null default 70,
  online boolean not null default false,
  current_location geography(point,4326),
  preferred_area text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fleets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  business_name text not null,
  business_registration_number text,
  tax_id text,
  address text,
  phone text,
  email text,
  verification_status public.verification_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id),
  fleet_id uuid references public.fleets(id) on delete set null,
  vehicle_type text not null,
  brand text,
  model text,
  year integer,
  color text,
  plate_number text not null unique,
  capacity integer not null check (capacity > 0),
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  is_primary boolean not null default false,
  active boolean not null default true,
  unique(driver_id, vehicle_id)
);

create table public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id),
  pickup_address text not null,
  pickup_location geography(point,4326) not null,
  dropoff_address text not null,
  dropoff_location geography(point,4326) not null,
  service_type text not null check (service_type in ('scheduled','transfer','local','instant')),
  vehicle_type text not null,
  scheduled_at timestamptz,
  estimated_distance_meters integer,
  estimated_duration_seconds integer,
  estimated_fare numeric(12,2),
  passenger_notes text,
  status public.ride_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ride_requests_passenger_idx on public.ride_requests(passenger_id, created_at desc);
create index ride_requests_status_idx on public.ride_requests(status, scheduled_at);
create index ride_requests_pickup_gix on public.ride_requests using gist(pickup_location);
create index drivers_location_gix on public.driver_profiles using gist(current_location);

create table public.ride_offers (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status public.ride_offer_status not null default 'pending',
  unique(ride_request_id, driver_id)
);

create table public.ride_assignments (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null unique references public.ride_requests(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  fleet_id uuid references public.fleets(id),
  assignment_type text not null check (assignment_type in ('automatic','manual','fleet','admin')),
  assigned_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null unique references public.ride_requests(id),
  driver_id uuid not null references public.driver_profiles(id),
  passenger_id uuid not null references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  trip_pin_hash text not null,
  started_at timestamptz,
  completed_at timestamptz,
  actual_distance_meters integer,
  actual_duration_seconds integer,
  final_fare numeric(12,2),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.fleets enable row level security;
alter table public.vehicles enable row level security;
alter table public.driver_vehicles enable row level security;
alter table public.ride_requests enable row level security;
alter table public.ride_offers enable row level security;
alter table public.ride_assignments enable row level security;
alter table public.trips enable row level security;

create policy "profiles_select_self" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "passengers_read_own_ride_requests" on public.ride_requests for select using (auth.uid() = passenger_id);
create policy "passengers_create_own_ride_requests" on public.ride_requests for insert with check (auth.uid() = passenger_id);

-- NOTE: Driver/fleet/admin policies are intentionally incomplete in migration 0001.
-- Implement them with server-authorized role checks and test them before enabling production workflows.
