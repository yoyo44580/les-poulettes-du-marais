create table if not exists public.kennel_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null unique,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kennel_blocked_dates enable row level security;

drop policy if exists "Anyone can read kennel blocked dates" on public.kennel_blocked_dates;
create policy "Anyone can read kennel blocked dates"
on public.kennel_blocked_dates
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage kennel blocked dates" on public.kennel_blocked_dates;
create policy "Admins manage kennel blocked dates"
on public.kennel_blocked_dates
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

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

  if new.start_date is null or new.end_date is null or new.end_date <= new.start_date then
    return new;
  end if;

  if exists (
    select 1
    from public.kennel_blocked_dates
    where blocked_date >= new.start_date
      and blocked_date < new.end_date
  ) then
    raise exception 'kennel_night_closed' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_blocked_kennel_booking_trigger on public.kennel_bookings;
create trigger prevent_blocked_kennel_booking_trigger
before insert or update of start_date, end_date, status
on public.kennel_bookings
for each row
execute function public.prevent_blocked_kennel_booking();
