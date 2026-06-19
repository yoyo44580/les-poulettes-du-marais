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
begin
  if new.end_date < new.start_date then
    raise exception 'kennel_invalid_dates' using errcode = '22023';
  end if;

  if coalesce(new.status, '') ilike 'annul%' then
    return new;
  end if;

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

    if v_count >= v_max then
      raise exception 'kennel_night_full' using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;

create or replace function public.prevent_blocked_kennel_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, '') ilike 'annul%' then
    return new;
  end if;

  if new.start_date is null or new.end_date is null or new.end_date < new.start_date then
    return new;
  end if;

  if exists (
    select 1
    from public.kennel_blocked_dates
    where blocked_date >= new.start_date
      and blocked_date <= new.end_date
  ) then
    raise exception 'kennel_night_closed' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.get_kennel_availability(
  p_start_date date,
  p_end_date date
)
returns table(
  night_date date,
  bookings_count integer
)
language sql
security definer
set search_path = public
as $$
  with days as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as day_date
  )
  select
    days.day_date as night_date,
    count(kennel_bookings.id)::integer as bookings_count
  from days
  left join public.kennel_bookings
    on kennel_bookings.start_date <= days.day_date
   and kennel_bookings.end_date >= days.day_date
   and kennel_bookings.archived_at is null
   and lower(coalesce(kennel_bookings.status, '')) not like 'annul%'
  group by days.day_date
  order by days.day_date;
$$;

revoke all on function public.get_kennel_availability(date, date) from public;
grant execute on function public.get_kennel_availability(date, date) to anon, authenticated;
