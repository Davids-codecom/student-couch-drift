alter table if exists public.user_profiles
  add column if not exists payout_account_holder text,
  add column if not exists payout_account_number text,
  add column if not exists payout_bank_name text,
  add column if not exists payout_bank_country text;
