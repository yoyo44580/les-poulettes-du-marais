create or replace function public.cancel_own_order(
  p_order_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_stock_id public.stock.id%type;
  v_current_stock integer;
  v_eggs_to_return integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select *
  into v_order
  from public.orders
  where id::text = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if v_order.user_id is distinct from auth.uid() then
    raise exception 'order_not_owned' using errcode = '42501';
  end if;

  if coalesce(v_order.status, '') ilike 'annul%' then
    return;
  end if;

  if coalesce(v_order.status, '') not in ('À préparer', 'A préparer', 'Demandée', 'Demandee') then
    raise exception 'order_already_in_progress' using errcode = 'P0001';
  end if;

  if coalesce(v_order.created_at, now()) < now() - interval '6 hours' then
    raise exception 'cancel_window_expired' using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_order.items) = 'array' and jsonb_array_length(v_order.items) > 0 then
    select coalesce(sum(
      coalesce((item->>'quantity')::integer, 0) *
      coalesce((item->>'size_eggs')::integer, 0)
    ), 0)
    into v_eggs_to_return
    from jsonb_array_elements(v_order.items) as item;
  else
    v_eggs_to_return := coalesce(v_order.box6, 0) * 6 + coalesce(v_order.box12, 0) * 12;
  end if;

  select id, eggs_available
  into v_stock_id, v_current_stock
  from public.stock
  order by id asc
  limit 1
  for update;

  if v_stock_id is null then
    raise exception 'stock_not_found' using errcode = 'P0001';
  end if;

  update public.stock
  set eggs_available = v_current_stock + v_eggs_to_return
  where id = v_stock_id;

  update public.orders
  set status = 'Annulée'
  where id::text = p_order_id;
end;
$$;

revoke all on function public.cancel_own_order(text) from public;
grant execute on function public.cancel_own_order(text) to authenticated;
