create or replace function public.sync_reservation_billing_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_type text;
  v_status text;
  v_document_id uuid;
  v_profile_address text := '';
  v_activity_price numeric(12, 2) := 0;
  v_is_treasure_hunt boolean := false;
  v_quantity numeric := 1;
  v_unit text := 'participant';
  v_unit_price numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_days numeric := 1;
  v_dog_name text := 'chien';
  v_description text := '';
  v_payment_status text := 'A payer';
begin
  v_source_type := case
    when tg_table_name = 'educational_bookings' then 'education'
    else 'kennel'
  end;
  v_status := lower(coalesce(new.status, ''));

  if v_status not like 'confirm%' and v_status not like 'termin%' then
    return new;
  end if;

  v_document_id := public.create_invoice_for_source(v_source_type, new.id::text);

  select coalesce(p.delivery_address, '')
  into v_profile_address
  from public.profiles p
  where p.id = new.user_id;

  v_payment_status := case
    when new.payment_received is true then 'Paye'
    when coalesce(new.deposit_amount, 0) > 0 then 'Acompte verse'
    else 'A payer'
  end;

  if v_source_type = 'education' then
    select coalesce(a.price, 0),
      coalesce(a.name, new.activity_type, 'Activite ferme pedagogique')
    into v_activity_price, v_description
    from public.education_activities a
    where a.id = new.activity_id;

    v_description := coalesce(nullif(v_description, ''), new.activity_type, 'Activite ferme pedagogique');
    v_is_treasure_hunt :=
      coalesce(new.activity_type, '') ilike '%jeu de piste%'
      or coalesce(new.activity_id, '') ilike '%piste%';
    v_quantity := case when v_is_treasure_hunt then 1 else greatest(coalesce(new.participants, 1), 1) end;
    v_unit := case when v_is_treasure_hunt then 'partie' else 'participant' end;
    v_total := coalesce(
      new.amount_confirmed,
      case
        when v_is_treasure_hunt then v_activity_price
        else v_activity_price * v_quantity
      end,
      0
    );
    v_unit_price := case when v_quantity > 0 then round(v_total / v_quantity, 2) else v_total end;

    update public.billing_documents
    set user_id = new.user_id,
        service_date = new.booking_date,
        due_date = new.booking_date,
        customer_snapshot = jsonb_build_object(
          'name', coalesce(new.client_name, 'Client'),
          'email', coalesce(new.client_email, ''),
          'phone', coalesce(new.phone, ''),
          'address', v_profile_address
        ),
        lines = jsonb_build_array(jsonb_build_object(
          'description', v_description,
          'quantity', v_quantity,
          'unit', v_unit,
          'unit_price', v_unit_price,
          'total', v_total
        )),
        subtotal = v_total,
        vat_rate = 0,
        vat_amount = 0,
        total = v_total,
        payment_status = v_payment_status,
        payment_method = coalesce(new.payment_method, '')
    where id = v_document_id;
  else
    select coalesce(d.name, 'chien')
    into v_dog_name
    from public.dogs d
    where d.id = new.dog_id;

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
      new.start_date,
      new.end_date,
      new.arrival_time,
      new.departure_time
    );
    v_total := coalesce(new.amount_confirmed, v_days * coalesce(v_unit_price, 0), 0);
    if new.amount_confirmed is not null and v_days > 0 then
      v_unit_price := round(v_total / v_days, 2);
    end if;
    v_description := format(
      'Sejour pension canine - %s - du %s au %s - arrivee %s depart %s',
      v_dog_name,
      new.start_date,
      new.end_date,
      to_char(coalesce(new.arrival_time, '09:00'::time), 'HH24:MI'),
      to_char(coalesce(new.departure_time, '18:00'::time), 'HH24:MI')
    );

    update public.billing_documents
    set user_id = new.user_id,
        service_date = new.start_date,
        due_date = new.start_date,
        customer_snapshot = jsonb_build_object(
          'name', coalesce(new.client_name, 'Client'),
          'email', coalesce(new.client_email, ''),
          'phone', coalesce(new.phone, ''),
          'address', coalesce(nullif(new.client_address, ''), v_profile_address, '')
        ),
        lines = jsonb_build_array(jsonb_build_object(
          'description', v_description,
          'quantity', v_days,
          'unit', 'jour facture',
          'unit_price', v_unit_price,
          'total', v_total
        )),
        subtotal = v_total,
        vat_rate = 0,
        vat_amount = 0,
        total = v_total,
        payment_status = v_payment_status,
        payment_method = coalesce(new.payment_method, '')
    where id = v_document_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_reservation_billing_document() from public;

drop trigger if exists education_billing_sync_insert_trigger on public.educational_bookings;
create trigger education_billing_sync_insert_trigger
after insert on public.educational_bookings
for each row execute function public.sync_reservation_billing_document();

drop trigger if exists education_billing_sync_update_trigger on public.educational_bookings;
create trigger education_billing_sync_update_trigger
after update of status, booking_date, participants, activity_id, activity_type,
  amount_confirmed, deposit_amount, payment_received, payment_method,
  client_name, client_email, phone
on public.educational_bookings
for each row execute function public.sync_reservation_billing_document();

drop trigger if exists kennel_billing_sync_insert_trigger on public.kennel_bookings;
create trigger kennel_billing_sync_insert_trigger
after insert on public.kennel_bookings
for each row execute function public.sync_reservation_billing_document();

drop trigger if exists kennel_billing_sync_update_trigger on public.kennel_bookings;
create trigger kennel_billing_sync_update_trigger
after update of status, start_date, end_date, arrival_time, departure_time,
  amount_confirmed, deposit_amount, payment_received, payment_method,
  client_name, client_email, client_address, phone, dog_id
on public.kennel_bookings
for each row execute function public.sync_reservation_billing_document();

update public.educational_bookings
set status = status
where lower(coalesce(status, '')) like 'confirm%'
   or lower(coalesce(status, '')) like 'termin%';

update public.kennel_bookings
set status = status
where lower(coalesce(status, '')) like 'confirm%'
   or lower(coalesce(status, '')) like 'termin%';

notify pgrst, 'reload schema';
