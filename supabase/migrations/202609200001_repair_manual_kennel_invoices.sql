create or replace function public.process_reservation_billing_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_type text;
  v_status text;
begin
  v_source_type := case
    when tg_table_name = 'educational_bookings' then 'education'
    else 'kennel'
  end;
  v_status := lower(coalesce(new.status, ''));

  if v_status like 'confirm%' or v_status like 'termin%' then
    perform public.create_invoice_for_source(v_source_type, new.id::text);
  elsif v_status like 'annul%' then
    perform public.create_credit_note_for_source(v_source_type, new.id::text);
  end if;

  return new;
end;
$$;

drop trigger if exists kennel_billing_document_trigger on public.kennel_bookings;
create trigger kennel_billing_document_trigger
after insert or update of status on public.kennel_bookings
for each row execute function public.process_reservation_billing_document();

do $$
declare
  v_booking record;
begin
  for v_booking in
    select kb.id
    from public.kennel_bookings kb
    where (
      lower(coalesce(kb.status, '')) like 'confirm%'
      or lower(coalesce(kb.status, '')) like 'termin%'
    )
    and not exists (
      select 1
      from public.billing_documents bd
      where bd.document_type = 'invoice'
        and bd.source_type = 'kennel'
        and bd.source_id = kb.id::text
    )
    order by kb.start_date nulls last, kb.created_at nulls last
  loop
    perform public.create_invoice_for_source('kennel', v_booking.id::text);
  end loop;
end $$;

notify pgrst, 'reload schema';
