with target_profiles as (
  select id
  from public.user_profiles
  where lower(email) = 'davids.akis@unil.ch'
)
delete from public.user_listings
where host_id in (select id from target_profiles);

with target_profiles as (
  select id
  from public.user_profiles
  where lower(email) = 'davids.akis@unil.ch'
)
delete from public.listings
where user_id in (select id from target_profiles);

with target_profiles as (
  select id
  from public.user_profiles
  where lower(email) = 'davids.akis@unil.ch'
)
delete from public.booking_requests
where host_id in (select id from target_profiles)
   or renter_id in (select id from target_profiles);

with target_profiles as (
  select id
  from public.user_profiles
  where lower(email) = 'davids.akis@unil.ch'
)
delete from public.direct_messages
where sender_id in (select id from target_profiles)
   or recipient_id in (select id from target_profiles);

delete from public.user_profiles
where lower(email) = 'davids.akis@unil.ch';

delete from auth.users
where lower(email) = 'davids.akis@unil.ch';
