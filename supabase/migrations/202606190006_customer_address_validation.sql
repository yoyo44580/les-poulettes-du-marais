alter table public.profiles
  add column if not exists address_validation_status text,
  add column if not exists address_validation_suggestion text,
  add column if not exists address_validation_score numeric,
  add column if not exists address_validation_checked_at timestamptz,
  add column if not exists address_previous_value text;

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
  order by profiles.created_at desc nulls last, coalesce(profiles.full_name, profiles.email, '') asc;
end;
$$;

create or replace function public.save_customer_address_validation(
  p_profile_id uuid,
  p_status text,
  p_suggestion text,
  p_score numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_status not in ('exact', 'suggestion', 'review', 'missing') then
    raise exception 'invalid_address_validation_status' using errcode = '22023';
  end if;

  update public.profiles
  set
    address_validation_status = p_status,
    address_validation_suggestion = nullif(trim(coalesce(p_suggestion, '')), ''),
    address_validation_score = p_score,
    address_validation_checked_at = now()
  where id = p_profile_id and coalesce(is_admin, false) = false;
end;
$$;

create or replace function public.accept_customer_address_suggestion(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  update public.profiles
  set
    address_previous_value = delivery_address,
    delivery_address = address_validation_suggestion,
    address_validation_status = 'exact',
    address_validation_score = 1,
    address_validation_checked_at = now()
  where id = p_profile_id
    and coalesce(is_admin, false) = false
    and nullif(trim(address_validation_suggestion), '') is not null;
end;
$$;

revoke all on function public.list_customer_profiles() from public;
grant execute on function public.list_customer_profiles() to authenticated;

revoke all on function public.save_customer_address_validation(uuid, text, text, numeric) from public;
grant execute on function public.save_customer_address_validation(uuid, text, text, numeric) to authenticated;

revoke all on function public.accept_customer_address_suggestion(uuid) from public;
grant execute on function public.accept_customer_address_suggestion(uuid) to authenticated;
