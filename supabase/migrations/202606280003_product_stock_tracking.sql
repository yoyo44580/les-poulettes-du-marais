alter table public.products
  add column if not exists stock_quantity integer;

alter table public.products
  drop constraint if exists products_stock_quantity_check;

alter table public.products
  add constraint products_stock_quantity_check
  check (stock_quantity is null or stock_quantity >= 0);

create or replace function public.reserve_tracked_product_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_index integer;
  v_item jsonb;
  v_product_id text;
  v_quantity integer;
  v_available integer;
  v_product_found boolean;
begin
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) = 0 then
    return new;
  end if;

  for v_index in 0..jsonb_array_length(new.items) - 1 loop
    v_item := new.items -> v_index;
    v_product_id := nullif(trim(v_item ->> 'product_id'), '');
    v_quantity := greatest(0, coalesce((v_item ->> 'quantity')::integer, 0));

    if v_product_id is null or v_quantity = 0 then
      continue;
    end if;

    select stock_quantity
    into v_available
    from public.products
    where id = v_product_id
    for update;
    v_product_found := found;

    if v_product_found and v_available is not null then
      if v_quantity > v_available then
        raise exception 'product_stock_insufficient:%', v_product_id using errcode = 'P0001';
      end if;

      update public.products
      set stock_quantity = stock_quantity - v_quantity,
          updated_at = now()
      where id = v_product_id;

      new.items := jsonb_set(
        new.items,
        array[v_index::text, 'stock_tracked'],
        'true'::jsonb,
        true
      );
    end if;
  end loop;

  return new;
end;
$$;

create or replace function public.sync_tracked_product_stock_on_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product_id text;
  v_quantity integer;
  v_available integer;
begin
  if jsonb_typeof(new.items) <> 'array' then
    return new;
  end if;

  if coalesce(new.status, '') ilike 'annul%'
     and coalesce(old.status, '') not ilike 'annul%' then
    for v_item in select value from jsonb_array_elements(new.items) loop
      if coalesce((v_item ->> 'stock_tracked')::boolean, false) is not true then
        continue;
      end if;

      v_product_id := nullif(trim(v_item ->> 'product_id'), '');
      v_quantity := greatest(0, coalesce((v_item ->> 'quantity')::integer, 0));

      update public.products
      set stock_quantity = stock_quantity + v_quantity,
          updated_at = now()
      where id = v_product_id and stock_quantity is not null;
    end loop;
  elsif coalesce(old.status, '') ilike 'annul%'
        and coalesce(new.status, '') not ilike 'annul%' then
    for v_item in
      select value
      from jsonb_array_elements(new.items)
      where coalesce((value ->> 'stock_tracked')::boolean, false) is true
      order by value ->> 'product_id'
    loop
      v_product_id := nullif(trim(v_item ->> 'product_id'), '');
      v_quantity := greatest(0, coalesce((v_item ->> 'quantity')::integer, 0));

      select stock_quantity
      into v_available
      from public.products
      where id = v_product_id
      for update;

      if found and v_available is not null then
        if v_quantity > v_available then
          raise exception 'product_stock_insufficient:%', v_product_id using errcode = 'P0001';
        end if;

        update public.products
        set stock_quantity = stock_quantity - v_quantity,
            updated_at = now()
        where id = v_product_id;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

create or replace function public.restore_tracked_product_stock_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product_id text;
  v_quantity integer;
begin
  if coalesce(old.status, '') ilike 'annul%' or jsonb_typeof(old.items) <> 'array' then
    return old;
  end if;

  for v_item in select value from jsonb_array_elements(old.items) loop
    if coalesce((v_item ->> 'stock_tracked')::boolean, false) is not true then
      continue;
    end if;

    v_product_id := nullif(trim(v_item ->> 'product_id'), '');
    v_quantity := greatest(0, coalesce((v_item ->> 'quantity')::integer, 0));

    update public.products
    set stock_quantity = stock_quantity + v_quantity,
        updated_at = now()
    where id = v_product_id and stock_quantity is not null;
  end loop;

  return old;
end;
$$;

drop trigger if exists reserve_tracked_product_stock_trigger on public.orders;
create trigger reserve_tracked_product_stock_trigger
before insert on public.orders
for each row execute function public.reserve_tracked_product_stock();

drop trigger if exists sync_tracked_product_stock_status_trigger on public.orders;
create trigger sync_tracked_product_stock_status_trigger
before update of status on public.orders
for each row execute function public.sync_tracked_product_stock_on_status();

drop trigger if exists restore_tracked_product_stock_delete_trigger on public.orders;
create trigger restore_tracked_product_stock_delete_trigger
before delete on public.orders
for each row execute function public.restore_tracked_product_stock_on_delete();

notify pgrst, 'reload schema';
