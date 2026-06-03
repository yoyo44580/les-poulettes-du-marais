alter table public.profiles
  add column if not exists internal_notes text;

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
  internal_notes text
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
    profiles.created_at,
    profiles.is_admin,
    profiles.can_order_eggs,
    profiles.internal_notes
  from public.profiles
  order by profiles.created_at desc nulls last, coalesce(profiles.full_name, profiles.email, '') asc;
end;
$$;

create or replace function public.update_customer_internal_notes(
  p_profile_id uuid,
  p_internal_notes text
)
returns void
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

  update public.profiles
  set internal_notes = nullif(trim(p_internal_notes), '')
  where id = p_profile_id;
end;
$$;

revoke all on function public.list_customer_profiles() from public;
grant execute on function public.list_customer_profiles() to authenticated;

revoke all on function public.update_customer_internal_notes(uuid, text) from public;
grant execute on function public.update_customer_internal_notes(uuid, text) to authenticated;
