drop trigger if exists set_education_booking_deduplication_key_trigger
  on public.educational_bookings;

drop index if exists public.educational_bookings_active_deduplication_uidx;

create or replace function public.education_booking_people_signature(
  p_accompanist_name text,
  p_children jsonb
)
returns text
language sql
stable
set search_path = public
as $$
  select md5(
    lower(regexp_replace(trim(coalesce(p_accompanist_name, '')), '\s+', ' ', 'g'))
    || '|'
    || coalesce((
      select string_agg(
        lower(regexp_replace(trim(coalesce(child ->> 'firstName', child ->> 'first_name', '')), '\s+', ' ', 'g'))
        || ':' || coalesce(child ->> 'age', ''),
        '|'
        order by
          lower(regexp_replace(trim(coalesce(child ->> 'firstName', child ->> 'first_name', '')), '\s+', ' ', 'g')),
          coalesce(child ->> 'age', '')
      )
      from jsonb_array_elements(
        case when jsonb_typeof(p_children) = 'array' then p_children else '[]'::jsonb end
      ) as child
    ), '')
  );
$$;

create or replace function public.education_booking_exact_deduplication_key(
  p_user_id uuid,
  p_date_slot_id uuid,
  p_activity_id text,
  p_activity_type text,
  p_booking_date date,
  p_accompanist_name text,
  p_children jsonb
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_user_id is null then null
    when p_date_slot_id is not null then
      p_user_id::text || ':slot:' || p_date_slot_id::text || ':people:' ||
      public.education_booking_people_signature(p_accompanist_name, p_children)
    when p_booking_date is not null then
      p_user_id::text || ':date:' || coalesce(p_activity_id, p_activity_type, '') || ':' ||
      p_booking_date::text || ':people:' ||
      public.education_booking_people_signature(p_accompanist_name, p_children)
    else null
  end;
$$;

update public.educational_bookings
set deduplication_key = null;

with ranked_bookings as (
  select
    id,
    public.education_booking_exact_deduplication_key(
      user_id,
      date_slot_id,
      activity_id,
      activity_type,
      booking_date,
      accompanist_name,
      children
    ) as exact_key,
    row_number() over (
      partition by public.education_booking_exact_deduplication_key(
        user_id,
        date_slot_id,
        activity_id,
        activity_type,
        booking_date,
        accompanist_name,
        children
      )
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.educational_bookings
  where user_id is not null
    and coalesce(status, '') not ilike 'annul%'
)
update public.educational_bookings as booking
set deduplication_key = ranked.exact_key
from ranked_bookings as ranked
where booking.id = ranked.id
  and ranked.duplicate_rank = 1
  and ranked.exact_key is not null;

create unique index educational_bookings_active_deduplication_uidx
  on public.educational_bookings (deduplication_key)
  where deduplication_key is not null;

create or replace function public.set_education_booking_deduplication_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.status, '') ilike 'annul%' then
    new.deduplication_key := null;
  else
    new.deduplication_key := public.education_booking_exact_deduplication_key(
      new.user_id,
      new.date_slot_id,
      new.activity_id,
      new.activity_type,
      new.booking_date,
      new.accompanist_name,
      new.children
    );
  end if;

  return new;
end;
$$;

create trigger set_education_booking_deduplication_key_trigger
before insert or update of user_id, date_slot_id, activity_id, activity_type, booking_date, accompanist_name, children, status
on public.educational_bookings
for each row execute function public.set_education_booking_deduplication_key();

notify pgrst, 'reload schema';
