alter table public.education_activities
  add column if not exists image_url text not null default '';

create table if not exists public.education_activity_dates (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null references public.education_activities(id) on delete cascade,
  activity_date date not null,
  label text not null default '',
  capacity integer not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_activity_dates_capacity_check check (capacity > 0)
);

create index if not exists education_activity_dates_activity_date_idx
  on public.education_activity_dates (activity_id, activity_date);

alter table public.educational_bookings
  add column if not exists activity_id text references public.education_activities(id) on delete set null,
  add column if not exists date_slot_id uuid references public.education_activity_dates(id) on delete set null,
  add column if not exists accompanist_name text not null default '',
  add column if not exists children jsonb not null default '[]'::jsonb;

drop policy if exists "Clients manage own educational bookings" on public.educational_bookings;

drop policy if exists "Clients and admins read educational bookings" on public.educational_bookings;
create policy "Clients and admins read educational bookings"
on public.educational_bookings
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Admins update educational bookings" on public.educational_bookings;
create policy "Admins update educational bookings"
on public.educational_bookings
for update
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
)
with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Admins delete educational bookings" on public.educational_bookings;
create policy "Admins delete educational bookings"
on public.educational_bookings
for delete
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

alter table public.education_activity_dates enable row level security;

drop policy if exists "Education dates are readable" on public.education_activity_dates;
create policy "Education dates are readable"
on public.education_activity_dates
for select
using (true);

drop policy if exists "Admins can insert education dates" on public.education_activity_dates;
create policy "Admins can insert education dates"
on public.education_activity_dates
for insert
to authenticated
with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Admins can update education dates" on public.education_activity_dates;
create policy "Admins can update education dates"
on public.education_activity_dates
for update
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
)
with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Admins can delete education dates" on public.education_activity_dates;
create policy "Admins can delete education dates"
on public.education_activity_dates
for delete
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

create or replace function public.create_education_booking(
  p_activity_id text,
  p_date_slot_id uuid,
  p_activity_type text,
  p_booking_date date,
  p_participants integer,
  p_accompanist_name text,
  p_children jsonb,
  p_client_name text,
  p_client_email text,
  p_phone text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_slot public.education_activity_dates%rowtype;
  v_booked integer := 0;
  v_booking_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_participants is null or p_participants < 1 then
    raise exception 'invalid_participants' using errcode = '22023';
  end if;

  if coalesce(trim(p_accompanist_name), '') = '' then
    raise exception 'accompanist_required' using errcode = '22023';
  end if;

  select *
  into v_slot
  from public.education_activity_dates
  where id = p_date_slot_id
    and activity_id = p_activity_id
    and activity_date = p_booking_date
  for update;

  if not found or v_slot.active is false then
    raise exception 'education_slot_unavailable' using errcode = 'P0001';
  end if;

  select coalesce(sum(participants), 0)
  into v_booked
  from public.educational_bookings
  where date_slot_id = p_date_slot_id
    and coalesce(status, '') not ilike 'annul%';

  if v_booked + p_participants > v_slot.capacity then
    raise exception 'education_slot_full' using errcode = 'P0001';
  end if;

  insert into public.educational_bookings (
    user_id,
    activity_id,
    date_slot_id,
    activity_type,
    booking_date,
    participants,
    accompanist_name,
    children,
    client_name,
    client_email,
    phone,
    notes
  )
  values (
    v_user_id,
    p_activity_id,
    p_date_slot_id,
    p_activity_type,
    p_booking_date,
    p_participants,
    trim(p_accompanist_name),
    coalesce(p_children, '[]'::jsonb),
    p_client_name,
    p_client_email,
    p_phone,
    p_notes
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_education_booking(text, uuid, text, date, integer, text, jsonb, text, text, text, text) from public;
grant execute on function public.create_education_booking(text, uuid, text, date, integer, text, jsonb, text, text, text, text) to authenticated;
