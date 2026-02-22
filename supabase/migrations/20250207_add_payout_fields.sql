alter table if exists public.booking_requests
  add column if not exists has_checkin_photo boolean default false,
  add column if not exists payout_status text default 'pending',
  add column if not exists payout_released_at timestamptz;
