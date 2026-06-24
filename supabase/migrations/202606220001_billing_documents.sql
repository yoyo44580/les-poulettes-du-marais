create table if not exists public.billing_document_counters (
  document_type text not null check (document_type in ('invoice', 'credit_note')),
  document_year integer not null,
  last_number integer not null default 0,
  primary key (document_type, document_year)
);

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('invoice', 'credit_note')),
  document_number text not null unique,
  document_year integer not null,
  sequence_number integer not null,
  source_type text not null check (source_type in ('order', 'education', 'kennel')),
  source_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  reference_document_id uuid references public.billing_documents(id) on delete restrict,
  issued_at timestamptz not null default now(),
  service_date date,
  due_date date,
  provider_snapshot jsonb not null,
  customer_snapshot jsonb not null,
  lines jsonb not null default '[]'::jsonb,
  subtotal numeric(12, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 0,
  vat_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  payment_status text not null default 'A payer',
  payment_method text,
  legal_notice text not null default 'TVA non applicable, article 293 B du CGI',
  created_at timestamptz not null default now(),
  unique (document_type, source_type, source_id)
);

alter table public.billing_documents enable row level security;
alter table public.billing_document_counters enable row level security;

drop policy if exists "Clients and admins read billing documents" on public.billing_documents;
create policy "Clients and admins read billing documents"
on public.billing_documents for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create index if not exists billing_documents_user_issued_idx
  on public.billing_documents (user_id, issued_at desc);
create index if not exists billing_documents_source_idx
  on public.billing_documents (source_type, source_id);

create or replace function public.next_billing_document_number(p_document_type text)
returns table(document_year integer, sequence_number integer, document_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from current_date)::integer;
  v_sequence integer;
  v_prefix text;
begin
  if p_document_type not in ('invoice', 'credit_note') then
    raise exception 'invalid_document_type';
  end if;

  insert into public.billing_document_counters (document_type, document_year, last_number)
  values (p_document_type, v_year, 1)
  on conflict on constraint billing_document_counters_pkey
  do update set last_number = billing_document_counters.last_number + 1
  returning last_number into v_sequence;

  v_prefix := case when p_document_type = 'invoice' then 'F' else 'A' end;

  return query select
    v_year,
    v_sequence,
    format('%s-%s-%s', v_prefix, v_year, lpad(v_sequence::text, 6, '0'));
end;
$$;

revoke all on function public.next_billing_document_number(text) from public;

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
  v_days integer := 1;
  v_document_id uuid;
  v_order record;
  v_booking record;
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

    v_days := greatest((v_booking.end_date - v_booking.start_date) + 1, 1);
    v_total := coalesce(v_booking.amount_confirmed, v_days * coalesce(v_unit_price, 0), 0);
    if v_booking.amount_confirmed is not null then
      v_unit_price := round(v_total / v_days, 2);
    end if;
    v_user_id := v_booking.user_id;
    v_client_name := coalesce(v_booking.client_name, 'Client');
    v_client_email := coalesce(v_booking.client_email, '');
    v_client_phone := coalesce(v_booking.phone, '');
    v_client_address := coalesce(nullif(v_booking.client_address, ''), v_booking.profile_address, '');
    v_service_date := v_booking.start_date;
    v_due_date := v_booking.start_date;
    v_description := format('Sejour pension canine - %s - du %s au %s', coalesce(v_booking.dog_name, 'chien'), v_booking.start_date, v_booking.end_date);
    v_lines := jsonb_build_array(jsonb_build_object(
      'description', v_description,
      'quantity', v_days,
      'unit', 'jour',
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

revoke all on function public.create_invoice_for_source(text, text) from public;

create or replace function public.create_credit_note_for_source(p_source_type text, p_source_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.billing_documents%rowtype;
  v_existing_id uuid;
  v_number record;
  v_document_id uuid;
  v_credit_lines jsonb;
begin
  select id into v_existing_id
  from public.billing_documents
  where document_type = 'credit_note' and source_type = p_source_type and source_id = p_source_id;
  if v_existing_id is not null then return v_existing_id; end if;

  select * into v_invoice
  from public.billing_documents
  where document_type = 'invoice' and source_type = p_source_type and source_id = p_source_id;
  if not found then return null; end if;

  select coalesce(jsonb_agg(line || jsonb_build_object(
    'quantity', -abs(coalesce((line->>'quantity')::numeric, 0)),
    'total', -abs(coalesce((line->>'total')::numeric, 0))
  )), '[]'::jsonb)
  into v_credit_lines
  from jsonb_array_elements(v_invoice.lines) line;

  select * into v_number from public.next_billing_document_number('credit_note');

  insert into public.billing_documents (
    document_type, document_number, document_year, sequence_number,
    source_type, source_id, user_id, reference_document_id,
    issued_at, service_date, due_date, provider_snapshot, customer_snapshot, lines,
    subtotal, vat_rate, vat_amount, total, payment_status, payment_method, legal_notice
  ) values (
    'credit_note', v_number.document_number, v_number.document_year, v_number.sequence_number,
    p_source_type, p_source_id, v_invoice.user_id, v_invoice.id,
    now(), v_invoice.service_date, current_date, v_invoice.provider_snapshot, v_invoice.customer_snapshot, v_credit_lines,
    -abs(v_invoice.subtotal), 0, 0, -abs(v_invoice.total), 'Avoir emis', v_invoice.payment_method, v_invoice.legal_notice
  ) returning id into v_document_id;

  return v_document_id;
end;
$$;

revoke all on function public.create_credit_note_for_source(text, text) from public;

create or replace function public.process_order_billing_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.status, '')) like 'annul%' then
    perform public.create_credit_note_for_source('order', new.id::text);
  else
    perform public.create_invoice_for_source('order', new.id::text);
  end if;
  return new;
end;
$$;

create or replace function public.process_reservation_billing_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_type text;
begin
  v_source_type := case when tg_table_name = 'educational_bookings' then 'education' else 'kennel' end;

  if lower(coalesce(new.status, '')) like 'confirm%' or lower(coalesce(new.status, '')) like 'termin%' then
    perform public.create_invoice_for_source(v_source_type, new.id::text);
  elsif lower(coalesce(new.status, '')) like 'annul%' then
    perform public.create_credit_note_for_source(v_source_type, new.id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists order_billing_document_trigger on public.orders;
create trigger order_billing_document_trigger
after insert or update of status on public.orders
for each row execute function public.process_order_billing_document();

drop trigger if exists education_billing_document_trigger on public.educational_bookings;
create trigger education_billing_document_trigger
after insert or update of status on public.educational_bookings
for each row execute function public.process_reservation_billing_document();

drop trigger if exists kennel_billing_document_trigger on public.kennel_bookings;
create trigger kennel_billing_document_trigger
after insert or update of status on public.kennel_bookings
for each row execute function public.process_reservation_billing_document();

notify pgrst, 'reload schema';
