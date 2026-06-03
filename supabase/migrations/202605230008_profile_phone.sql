alter table public.profiles
  add column if not exists phone text;

drop function if exists public.list_customer_profiles();

create or replace function public.list_customer_profiles()
returns table(
  id uuid,
  full_name text,
  email text,
  phone text,
  delivery_address text,
  is_admin boolean,
  can_order_eggs boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return query
  select
    profiles.id,
    profiles.full_name,
    profiles.email,
    profiles.phone,
    profiles.delivery_address,
    profiles.is_admin,
    profiles.can_order_eggs
  from public.profiles
  order by coalesce(profiles.full_name, profiles.email, '') asc;
end;
$$;

revoke all on function public.list_customer_profiles() from public;
grant execute on function public.list_customer_profiles() to authenticated;
