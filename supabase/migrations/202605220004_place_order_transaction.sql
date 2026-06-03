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
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
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

