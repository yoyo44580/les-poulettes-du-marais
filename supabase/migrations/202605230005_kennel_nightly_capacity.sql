create or replace function public.enforce_kennel_nightly_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_night date;
  v_count integer;
  v_max integer := 4;
begin
  if new.end_date <= new.start_date then
    raise exception 'kennel_invalid_dates' using errcode = '22023';
  end if;

  if coalesce(new.status, '') ilike 'annul%' then
    return new;
  end if;

  for v_night in
    select generate_series(new.start_date, new.end_date - interval '1 day', interval '1 day')::date
  loop
    select count(*)
    into v_count
    from public.kennel_bookings
    where id is distinct from new.id
      and coalesce(status, '') not ilike 'annul%'
      and start_date <= v_night
      and end_date > v_night;

    if v_count >= v_max then
      raise exception 'kennel_night_full' using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists enforce_kennel_nightly_capacity_trigger on public.kennel_bookings;
create trigger enforce_kennel_nightly_capacity_trigger
before insert or update of start_date, end_date, status
on public.kennel_bookings
for each row
execute function public.enforce_kennel_nightly_capacity();
