alter table public.products
  alter column stock_quantity set default 0;

update public.products
set stock_quantity = 0,
    updated_at = now()
where stock_quantity is null
  and coalesce(size_eggs, 0) = 0;

create or replace function public.ensure_non_egg_product_stock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.size_eggs, 0) = 0 and new.stock_quantity is null then
    new.stock_quantity := 0;
  end if;

  if coalesce(new.size_eggs, 0) > 0 then
    new.stock_quantity := null;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_non_egg_product_stock_trigger on public.products;
create trigger ensure_non_egg_product_stock_trigger
before insert or update of size_eggs, stock_quantity on public.products
for each row execute function public.ensure_non_egg_product_stock();

notify pgrst, 'reload schema';
