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

drop trigger if exists order_billing_document_trigger on public.orders;
create trigger order_billing_document_trigger
after insert or update of status on public.orders
for each row execute function public.process_order_billing_document();

notify pgrst, 'reload schema';
