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
   and kennel_bookings.end_date > nights.night_date
   and kennel_bookings.archived_at is null
   and lower(coalesce(kennel_bookings.status, '')) not like 'annul%'
  group by nights.night_date
  order by nights.night_date;
$$;

revoke all on function public.get_kennel_availability(date, date) from public;
grant execute on function public.get_kennel_availability(date, date) to anon, authenticated;
