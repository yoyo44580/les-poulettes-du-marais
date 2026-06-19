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
  if new.end_date < new.start_date then
    raise exception 'kennel_invalid_dates' using errcode = '22023';
  end if;

  if coalesce(new.status, '') ilike 'annul%' then
    return new;
  end if;

  for v_night in
    select generate_series(
      new.start_date,
      case
        when new.end_date = new.start_date then new.start_date
        else (new.end_date - interval '1 day')::date
      end,
      interval '1 day'
    )::date
  loop
    select count(*)
    into v_count
    from public.kennel_bookings
    where id is distinct from new.id
      and coalesce(status, '') not ilike 'annul%'
      and start_date <= v_night
      and (
        case
          when end_date = start_date then end_date + interval '1 day'
          else end_date
        end
      ) > v_night;

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
      and blocked_date < (
        case
          when new.end_date = new.start_date then new.end_date + interval '1 day'
          else new.end_date
        end
      )
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
  with nights as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as night_date
  )
  select
    nights.night_date,
    count(kennel_bookings.id)::integer as bookings_count
  from nights
  left join public.kennel_bookings
    on kennel_bookings.start_date <= nights.night_date
   and (
      case
        when kennel_bookings.end_date = kennel_bookings.start_date then kennel_bookings.end_date + interval '1 day'
        else kennel_bookings.end_date
      end
   ) > nights.night_date
   and kennel_bookings.archived_at is null
   and lower(coalesce(kennel_bookings.status, '')) not like 'annul%'
  group by nights.night_date
  order by nights.night_date;
$$;

revoke all on function public.get_kennel_availability(date, date) from public;
grant execute on function public.get_kennel_availability(date, date) to anon, authenticated;
