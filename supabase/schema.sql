-- Supabase schema for CouchStay platform
-- Creates tables to store student user profiles and host onboarding data.

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  user_role text not null check (user_role in ('host', 'renter')) default 'renter',
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.host_listings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  address text not null,
  property_type text not null check (property_type in ('house', 'flat')),
  price_per_night numeric(10, 2) not null check (price_per_night > 0),
  check_in_time text not null,
  document_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists host_listings_user_id_idx on public.host_listings (user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute procedure public.handle_updated_at();

drop trigger if exists host_listings_updated_at on public.host_listings;
create trigger host_listings_updated_at
before update on public.host_listings
for each row execute procedure public.handle_updated_at();

alter table public.profiles enable row level security;
alter table public.host_listings enable row level security;

create policy "Profiles are viewable by their owner" on public.profiles
  for select using (auth.uid() = id);

create policy "Profiles can be inserted by the owner" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Profiles can be updated by the owner" on public.profiles
  for update using (auth.uid() = id);

create policy "Hosts can view their listings" on public.host_listings
  for select using (auth.uid() = user_id);

create policy "Hosts can insert their listings" on public.host_listings
  for insert with check (auth.uid() = user_id);

create policy "Hosts can update their listings" on public.host_listings
  for update using (auth.uid() = user_id);
