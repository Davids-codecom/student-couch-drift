delete from public.user_profiles
where lower(email) = 'davids.akis@unil.ch';

delete from auth.users
where lower(email) = 'davids.akis@unil.ch';
