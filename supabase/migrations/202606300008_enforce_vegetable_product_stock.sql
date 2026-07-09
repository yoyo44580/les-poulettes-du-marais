-- Corrige les legumes qui auraient ete enregistres par erreur comme des oeufs.
update public.products
set size_eggs = 0,
    stock_quantity = coalesce(stock_quantity, 0),
    updated_at = now()
where replace(lower(coalesce(name, '')), 'œ', 'oe') not like '%oeuf%';

create or replace function public.ensure_non_egg_product_stock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_egg boolean;
begin
  v_is_egg := replace(lower(coalesce(new.name, '')), 'œ', 'oe') like '%oeuf%';

  if v_is_egg then
    new.stock_quantity := null;
  else
    new.size_eggs := 0;
    new.stock_quantity := greatest(0, coalesce(new.stock_quantity, 0));
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_non_egg_product_stock_trigger on public.products;
create trigger ensure_non_egg_product_stock_trigger
before insert or update of name, size_eggs, stock_quantity on public.products
for each row execute function public.ensure_non_egg_product_stock();

-- Verrou final cote Supabase : une commande ne peut jamais depasser le stock,
-- meme si le client utilise encore une ancienne version en cache.
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

    if not v_product_found then
      raise exception 'product_not_found:%', v_product_id using errcode = 'P0001';
    end if;

    if v_available is not null then
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

drop trigger if exists reserve_tracked_product_stock_trigger on public.orders;
create trigger reserve_tracked_product_stock_trigger
before insert on public.orders
for each row execute function public.reserve_tracked_product_stock();

notify pgrst, 'reload schema';
