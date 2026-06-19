drop function if exists public.list_customer_profiles();

create or replace function public.list_customer_profiles()
returns table(
  id uuid,
  full_name text,
  email text,
  phone text,
  delivery_address text,
  created_at timestamptz,
  is_admin boolean,
  can_order_eggs boolean,
  internal_notes text,
  address_validation_status text,
  address_validation_suggestion text,
  address_validation_score numeric,
  address_validation_checked_at timestamptz,
  address_previous_value text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return query
  select
    profiles.id,
    profiles.full_name,
    profiles.email,
    profiles.phone,
    profiles.delivery_address,
    profiles.created_at,
    profiles.is_admin,
    profiles.can_order_eggs,
    profiles.internal_notes,
    profiles.address_validation_status,
    profiles.address_validation_suggestion,
    profiles.address_validation_score,
    profiles.address_validation_checked_at,
    profiles.address_previous_value
  from public.profiles
  order by profiles.created_at desc nulls last,
    coalesce(profiles.full_name, profiles.email, '') asc;
end;
$$;

revoke all on function public.list_customer_profiles() from public;
grant execute on function public.list_customer_profiles() to authenticated;

create or replace function public.list_customer_profiles_v2()
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return query
  select profiles.*
  from public.profiles
  order by profiles.created_at desc nulls last,
    coalesce(profiles.full_name, profiles.email, '') asc;
end;
$$;

revoke all on function public.list_customer_profiles_v2() from public;
grant execute on function public.list_customer_profiles_v2() to authenticated;

notify pgrst, 'reload schema';
