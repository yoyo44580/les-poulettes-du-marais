alter table public.kennel_bookings
  add column if not exists arrival_time time not null default '09:00',
  add column if not exists departure_time time not null default '18:00';

comment on column public.kennel_bookings.arrival_time is
  'Heure prévue de dépose du chien pour calculer les demi-journées de pension.';

comment on column public.kennel_bookings.departure_time is
  'Heure prévue de récupération du chien pour calculer les demi-journées de pension.';

create or replace function public.calculate_kennel_billable_days(
  p_start_date date,
  p_end_date date,
  p_arrival_time time default '09:00',
  p_departure_time time default '18:00'
)
returns numeric
language sql
immutable
as $$
  select case
    when p_start_date is null or p_end_date is null or p_end_date < p_start_date then 0
    when greatest((p_end_date - p_start_date) + 1, 1) = 1 then 1
    else
      (case when coalesce(p_arrival_time, '09:00'::time) >= '12:00'::time then 0.5 else 1 end)
      + greatest(((p_end_date - p_start_date) + 1) - 2, 0)
      + (case when coalesce(p_departure_time, '18:00'::time) < '12:00'::time then 0.5 else 1 end)
  end::numeric;
$$;

create or replace function public.create_invoice_for_source(p_source_type text, p_source_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_number record;
  v_user_id uuid;
  v_client_name text := '';
  v_client_email text := '';
  v_client_phone text := '';
  v_client_address text := '';
  v_service_date date;
  v_due_date date;
  v_lines jsonb := '[]'::jsonb;
  v_total numeric(12, 2) := 0;
  v_payment_status text := 'A payer';
  v_payment_method text := '';
  v_description text := '';
  v_quantity numeric := 1;
  v_unit_price numeric(12, 2) := 0;
  v_days numeric := 1;
  v_order record;
  v_booking record;
  v_document_id uuid;
begin
  select id into v_existing_id
  from public.billing_documents
  where document_type = 'invoice'
    and source_type = p_source_type
    and source_id = p_source_id;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if p_source_type = 'order' then
    select o.* into v_order from public.orders o where o.id::text = p_source_id;
    if not found then raise exception 'source_not_found'; end if;

    v_user_id := v_order.user_id;
    v_client_name := coalesce(v_order.client_name, 'Client');
    v_client_email := coalesce(v_order.client_email, '');
    v_client_address := coalesce(v_order.delivery_address, '');
    v_service_date := v_order.delivery_date;
    v_due_date := v_order.delivery_date;

    if jsonb_typeof(v_order.items) = 'array' and jsonb_array_length(v_order.items) > 0 then
      select
        coalesce(jsonb_agg(jsonb_build_object(
          'description', coalesce(item->>'name', product.name, 'Produit'),
          'quantity', coalesce(nullif(item->>'quantity', '')::numeric, 0),
          'unit', coalesce(item->>'unit_label', product.unit_label, 'unite'),
          'unit_price', coalesce(nullif(item->>'price', '')::numeric, product.price, 0),
          'total', round(
            coalesce(nullif(item->>'quantity', '')::numeric, 0)
            * coalesce(nullif(item->>'price', '')::numeric, product.price, 0),
            2
          )
        )), '[]'::jsonb),
        coalesce(sum(
          coalesce(nullif(item->>'quantity', '')::numeric, 0)
          * coalesce(nullif(item->>'price', '')::numeric, product.price, 0)
        ), 0)
      into v_lines, v_total
      from jsonb_array_elements(v_order.items) item
      left join public.products product on product.id = item->>'product_id';
    else
      select coalesce(jsonb_agg(line), '[]'::jsonb), coalesce(sum((line->>'total')::numeric), 0)
      into v_lines, v_total
      from (
        select jsonb_build_object(
          'description', p.name,
          'quantity', q.quantity,
          'unit', p.unit_label,
          'unit_price', p.price,
          'total', round(q.quantity * p.price, 2)
        ) as line
        from (values ('box6', coalesce(v_order.box6, 0)::numeric), ('box12', coalesce(v_order.box12, 0)::numeric)) q(product_id, quantity)
        join public.products p on p.id = q.product_id
        where q.quantity > 0
      ) legacy_lines;
    end if;
  elsif p_source_type = 'education' then
    select b.*, p.delivery_address as profile_address, a.price as activity_price
    into v_booking
    from public.educational_bookings b
    left join public.profiles p on p.id = b.user_id
    left join public.education_activities a on a.id = b.activity_id
    where b.id::text = p_source_id;
    if not found then raise exception 'source_not_found'; end if;

    v_user_id := v_booking.user_id;
    v_client_name := coalesce(v_booking.client_name, 'Client');
    v_client_email := coalesce(v_booking.client_email, '');
    v_client_phone := coalesce(v_booking.phone, '');
    v_client_address := coalesce(v_booking.profile_address, '');
    v_service_date := v_booking.booking_date;
    v_due_date := v_booking.booking_date;
    v_quantity := greatest(coalesce(v_booking.participants, 1), 1);
    v_total := coalesce(v_booking.amount_confirmed, coalesce(v_booking.activity_price, 0) * v_quantity, 0);
    v_unit_price := case when v_quantity > 0 then round(v_total / v_quantity, 2) else v_total end;
    v_description := coalesce(v_booking.activity_type, 'Activite ferme pedagogique');
    v_lines := jsonb_build_array(jsonb_build_object(
      'description', v_description,
      'quantity', v_quantity,
      'unit', 'participant',
      'unit_price', v_unit_price,
      'total', v_total
    ));
    v_payment_status := case
      when v_booking.payment_received is true then 'Paye'
      when coalesce(v_booking.deposit_amount, 0) > 0 then 'Acompte verse'
      else 'A payer'
    end;
    v_payment_method := coalesce(v_booking.payment_method, '');
  elsif p_source_type = 'kennel' then
    select b.*, p.delivery_address as profile_address, d.name as dog_name
    into v_booking
    from public.kennel_bookings b
    left join public.profiles p on p.id = b.user_id
    left join public.dogs d on d.id = b.dog_id
    where b.id::text = p_source_id;
    if not found then raise exception 'source_not_found'; end if;

    select coalesce(s.price, 0)
    into v_unit_price
    from public.kennel_services s
    where s.active is not false
    order by
      case when lower(coalesce(s.unit_label, '')) like '%jour%' then 0 else 1 end,
      case when s.id = 'day-care' then 0 when s.id = 'overnight' then 1 else 2 end,
      s.sort_order
    limit 1;

    v_days := public.calculate_kennel_billable_days(
      v_booking.start_date,
      v_booking.end_date,
      v_booking.arrival_time,
      v_booking.departure_time
    );
    v_total := coalesce(v_booking.amount_confirmed, v_days * coalesce(v_unit_price, 0), 0);
    if v_booking.amount_confirmed is not null and v_days > 0 then
      v_unit_price := round(v_total / v_days, 2);
    end if;
    v_user_id := v_booking.user_id;
    v_client_name := coalesce(v_booking.client_name, 'Client');
    v_client_email := coalesce(v_booking.client_email, '');
    v_client_phone := coalesce(v_booking.phone, '');
    v_client_address := coalesce(nullif(v_booking.client_address, ''), v_booking.profile_address, '');
    v_service_date := v_booking.start_date;
    v_due_date := v_booking.start_date;
    v_description := format(
      'Sejour pension canine - %s - du %s au %s - arrivee %s depart %s',
      coalesce(v_booking.dog_name, 'chien'),
      v_booking.start_date,
      v_booking.end_date,
      to_char(coalesce(v_booking.arrival_time, '09:00'::time), 'HH24:MI'),
      to_char(coalesce(v_booking.departure_time, '18:00'::time), 'HH24:MI')
    );
    v_lines := jsonb_build_array(jsonb_build_object(
      'description', v_description,
      'quantity', v_days,
      'unit', 'jour facture',
      'unit_price', v_unit_price,
      'total', v_total
    ));
    v_payment_status := case
      when v_booking.payment_received is true then 'Paye'
      when coalesce(v_booking.deposit_amount, 0) > 0 then 'Acompte verse'
      else 'A payer'
    end;
    v_payment_method := coalesce(v_booking.payment_method, '');
  else
    raise exception 'invalid_source_type';
  end if;

  select * into v_number from public.next_billing_document_number('invoice');

  insert into public.billing_documents (
    document_type, document_number, document_year, sequence_number,
    source_type, source_id, user_id, issued_at, service_date, due_date,
    provider_snapshot, customer_snapshot, lines,
    subtotal, vat_rate, vat_amount, total, payment_status, payment_method
  ) values (
    'invoice', v_number.document_number, v_number.document_year, v_number.sequence_number,
    p_source_type, p_source_id, v_user_id, now(), v_service_date, v_due_date,
    jsonb_build_object(
      'name', 'AUGUSTE Marie',
      'company', 'Les Poulettes du Marais',
      'legal_form', 'Micro-BA',
      'address', '61 Les Ruelles, 44580 Bourneuf-en-Retz',
      'phone', '06 70 20 38 91',
      'email', 'lespoulettesdumarais@gmail.com',
      'siret', '89493132800013',
      'website', 'lespoulettesdumarais.fr'
    ),
    jsonb_build_object(
      'name', v_client_name,
      'email', v_client_email,
      'phone', v_client_phone,
      'address', v_client_address
    ),
    coalesce(v_lines, '[]'::jsonb),
    round(v_total, 2), 0, 0, round(v_total, 2), v_payment_status, v_payment_method
  ) returning id into v_document_id;

  return v_document_id;
end;
$$;

notify pgrst, 'reload schema';
