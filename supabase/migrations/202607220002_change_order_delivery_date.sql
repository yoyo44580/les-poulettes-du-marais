create or replace function public.change_order_delivery_date(
  p_order_id text,
  p_delivery_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_order public.orders%rowtype;
  v_slot public.delivery_slots%rowtype;
  v_slot_exists boolean := false;
  v_existing_orders integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_delivery_date is null or p_delivery_date < current_date then
    raise exception 'order_date_not_allowed' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
  into v_is_admin;

  select *
  into v_order
  from public.orders
  where id::text = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if not coalesce(v_is_admin, false) and v_order.user_id is distinct from auth.uid() then
    raise exception 'order_not_owned' using errcode = '42501';
  end if;

  if coalesce(v_order.status, '') ilike 'annul%' then
    raise exception 'order_cancelled' using errcode = 'P0001';
  end if;

  if not coalesce(v_is_admin, false)
    and coalesce(v_order.status, '') not in ('À préparer', 'A préparer', 'Demandée', 'Demandee') then
    raise exception 'order_already_in_progress' using errcode = 'P0001';
  end if;

  select *
  into v_slot
  from public.delivery_slots
  where delivery_date = p_delivery_date
  for update;

  v_slot_exists := found;

  if v_slot_exists and v_slot.active is false then
    raise exception 'order_date_not_allowed' using errcode = 'P0001';
  end if;

  if not v_slot_exists and extract(dow from p_delivery_date) not in (1, 2, 4, 5) then
    raise exception 'order_date_not_allowed' using errcode = 'P0001';
  end if;

  if v_slot_exists and coalesce(v_slot.max_orders, 0) > 0 then
    select count(*)
    into v_existing_orders
    from public.orders
    where delivery_date = p_delivery_date
      and id::text <> p_order_id
      and coalesce(status, '') not ilike 'annul%';

    if v_existing_orders >= v_slot.max_orders then
      raise exception 'delivery_slot_full' using errcode = 'P0001';
    end if;
  end if;

  update public.orders
  set delivery_date = p_delivery_date
  where id::text = p_order_id;

  update public.billing_documents
  set service_date = p_delivery_date,
      due_date = p_delivery_date
  where source_type = 'order'
    and source_id = p_order_id
    and document_type = 'invoice';
end;
$$;

revoke all on function public.change_order_delivery_date(text, date) from public;
grant execute on function public.change_order_delivery_date(text, date) to authenticated;

notify pgrst, 'reload schema';
