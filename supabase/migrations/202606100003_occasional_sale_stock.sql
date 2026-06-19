create or replace function public.create_occasional_sale_reservation(
  p_item_id text,
  p_quantity integer,
  p_client_name text,
  p_client_email text,
  p_phone text,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_value jsonb;
  updated_items jsonb := '[]'::jsonb;
  sale_item jsonb;
  found_item boolean := false;
  item_name text := '';
  available_text text := '';
  available_quantity integer;
  new_available_quantity integer;
  new_reservation_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'occasional_sale_invalid_quantity';
  end if;

  if nullif(btrim(coalesce(p_client_name, '')), '') is null
    or nullif(btrim(coalesce(p_client_email, '')), '') is null
    or nullif(btrim(coalesce(p_phone, '')), '') is null then
    raise exception 'occasional_sale_contact_required';
  end if;

  select value
  into settings_value
  from public.site_settings
  where key = 'occasional_sales'
  for update;

  if settings_value is null then
    raise exception 'occasional_sales_missing';
  end if;

  for sale_item in
    select value from jsonb_array_elements(coalesce(settings_value->'items', '[]'::jsonb))
  loop
    if sale_item->>'id' = p_item_id then
      found_item := true;
      item_name := coalesce(nullif(sale_item->>'name', ''), 'Vente ponctuelle');

      if coalesce((sale_item->>'active')::boolean, true) = false then
        raise exception 'occasional_sale_inactive';
      end if;

      available_text := btrim(coalesce(sale_item->>'available_quantity', ''));

      if available_text <> '' and available_text ~ '^[0-9]+$' then
        available_quantity := available_text::integer;

        if available_quantity <= 0 then
          raise exception 'occasional_sale_sold_out';
        end if;

        if p_quantity > available_quantity then
          raise exception 'occasional_sale_not_enough_stock';
        end if;

        new_available_quantity := available_quantity - p_quantity;
        sale_item := jsonb_set(
          sale_item,
          '{available_quantity}',
          to_jsonb(new_available_quantity::text),
          true
        );
      end if;
    end if;

    updated_items := updated_items || jsonb_build_array(sale_item);
  end loop;

  if found_item = false then
    raise exception 'occasional_sale_item_missing';
  end if;

  insert into public.occasional_sale_reservations (
    item_id,
    item_name,
    quantity,
    client_name,
    client_email,
    phone,
    notes,
    status
  )
  values (
    p_item_id,
    item_name,
    p_quantity,
    btrim(p_client_name),
    btrim(p_client_email),
    btrim(p_phone),
    nullif(btrim(coalesce(p_notes, '')), ''),
    'Nouvelle'
  )
  returning id into new_reservation_id;

  settings_value := jsonb_set(settings_value, '{items}', updated_items, true);

  update public.site_settings
  set value = settings_value
  where key = 'occasional_sales';

  return jsonb_build_object(
    'reservation_id', new_reservation_id,
    'updated_content', settings_value
  );
end;
$$;

grant execute on function public.create_occasional_sale_reservation(text, integer, text, text, text, text)
to anon, authenticated;
