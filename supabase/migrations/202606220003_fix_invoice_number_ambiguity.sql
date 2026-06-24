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

  return query
  select
    v_year,
    v_sequence,
    format('%s-%s-%s', v_prefix, v_year, lpad(v_sequence::text, 6, '0'));
end;
$$;

revoke all on function public.next_billing_document_number(text) from public;

notify pgrst, 'reload schema';
