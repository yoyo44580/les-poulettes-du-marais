alter table public.profiles
  add column if not exists phone text;

alter table public.profiles
  add column if not exists delivery_address text;

update public.profiles
set
  phone = coalesce(nullif(public.profiles.phone, ''), nullif(auth.users.raw_user_meta_data->>'phone', '')),
  delivery_address = coalesce(nullif(public.profiles.delivery_address, ''), nullif(auth.users.raw_user_meta_data->>'delivery_address', ''))
from auth.users
where auth.users.id = public.profiles.id
  and (
    (public.profiles.phone is null or public.profiles.phone = '')
    or (public.profiles.delivery_address is null or public.profiles.delivery_address = '')
  );
