alter table public.profiles
  add column if not exists can_order_eggs boolean not null default false;

update public.profiles
set can_order_eggs = true
where is_admin = true;

revoke update (can_order_eggs) on public.profiles from authenticated;

create or replace function public.set_customer_egg_access(
  p_profile_id uuid,
  p_allowed boolean
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
    where id = auth.uid()
      and is_admin = true
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  update public.profiles
  set can_order_eggs = coalesce(p_allowed, false)
  where id = p_profile_id
    and coalesce(is_admin, false) = false;
end;
$$;

revoke all on function public.set_customer_egg_access(uuid, boolean) from public;
grant execute on function public.set_customer_egg_access(uuid, boolean) to authenticated;

create or replace function public.list_customer_profiles()
returns table(
  id uuid,
  full_name text,
  email text,
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
    profiles.delivery_address,
    profiles.is_admin,
    profiles.can_order_eggs
  from public.profiles
  order by coalesce(profiles.full_name, profiles.email, '') asc;
end;
$$;

revoke all on function public.list_customer_profiles() from public;
grant execute on function public.list_customer_profiles() to authenticated;

create or replace function public.place_order(
  p_client_email text,
  p_client_name text,
  p_box6 integer,
  p_box12 integer,
  p_delivery_date date,
  p_delivery_address text,
  p_comment text,
  p_items jsonb,
  p_eggs_needed integer,
  p_status text
)
returns table(order_id text, stock_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_id public.stock.id%type;
  v_real_stock integer;
  v_order_id text;
  v_slot public.delivery_slots%rowtype;
  v_slot_exists boolean := false;
  v_existing_orders integer := 0;
  v_user_id uuid := auth.uid();
  v_can_order_eggs boolean := false;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select exists (
    select 1
    from public.profiles
    where id = v_user_id
      and (is_admin = true or can_order_eggs = true)
  )
  into v_can_order_eggs;

  if not v_can_order_eggs then
    raise exception 'egg_order_access_denied' using errcode = '42501';
  end if;

  if p_delivery_date is null then
    raise exception 'delivery_date_required' using errcode = '22023';
  end if;

  if coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'delivery_address_required' using errcode = '22023';
  end if;

  if coalesce(p_eggs_needed, 0) < 0 then
    raise exception 'invalid_eggs_needed' using errcode = '22023';
  end if;

  select *
  into v_slot
  from public.delivery_slots
  where delivery_date = p_delivery_date
  for update;

  v_slot_exists := found;

  if v_slot_exists and v_slot.active is false then
    raise exception 'delivery_slot_closed' using errcode = 'P0001';
  end if;

  if not v_slot_exists and extract(dow from p_delivery_date) not in (1, 2, 4, 5) then
    raise exception 'delivery_slot_unavailable' using errcode = 'P0001';
  end if;

  if v_slot_exists and coalesce(v_slot.max_orders, 0) > 0 then
    select count(*)
    into v_existing_orders
    from public.orders
    where delivery_date = p_delivery_date
      and coalesce(status, '') not ilike 'annul%';

    if v_existing_orders >= v_slot.max_orders then
      raise exception 'delivery_slot_full' using errcode = 'P0001';
    end if;
  end if;

  select id, eggs_available
  into v_stock_id, v_real_stock
  from public.stock
  order by id asc
  limit 1
  for update;

  if v_stock_id is null then
    raise exception 'stock_not_found' using errcode = 'P0001';
  end if;

  if coalesce(p_eggs_needed, 0) > v_real_stock then
    raise exception 'stock_insufficient' using errcode = 'P0001';
  end if;

  insert into public.orders (
    user_id,
    client_email,
    client_name,
    box6,
    box12,
    delivery_date,
    status,
    delivery_address,
    comment,
    items
  )
  values (
    v_user_id,
    p_client_email,
    p_client_name,
    coalesce(p_box6, 0),
    coalesce(p_box12, 0),
    p_delivery_date,
    p_status,
    p_delivery_address,
    p_comment,
    p_items
  )
  returning id::text into v_order_id;

  update public.stock
  set eggs_available = v_real_stock - coalesce(p_eggs_needed, 0)
  where id = v_stock_id
  returning eggs_available into stock_remaining;

  order_id := v_order_id;
  return next;
end;
$$;

revoke all on function public.place_order(text, text, integer, integer, date, text, text, jsonb, integer, text) from public;
grant execute on function public.place_order(text, text, integer, integer, date, text, text, jsonb, integer, text) to authenticated;
