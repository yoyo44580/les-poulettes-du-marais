create or replace function public.enforce_kennel_nightly_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_count integer;
  v_max integer := 4;
  v_is_admin boolean := false;
begin
  if new.end_date < new.start_date then
    raise exception 'kennel_invalid_dates' using errcode = '22023';
  end if;

  if coalesce(new.status, '') ilike 'annul%' then
    return new;
  end if;

  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
  into v_is_admin;

  for v_day in
    select generate_series(new.start_date, new.end_date, interval '1 day')::date
  loop
    select count(*)
    into v_count
    from public.kennel_bookings
    where id is distinct from new.id
      and coalesce(status, '') not ilike 'annul%'
      and start_date <= v_day
      and end_date >= v_day;

    if v_count >= v_max + 1 or (v_count >= v_max and not v_is_admin) then
      raise exception 'kennel_night_full' using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;
