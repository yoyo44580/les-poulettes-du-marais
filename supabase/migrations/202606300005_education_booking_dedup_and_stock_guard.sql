alter table public.educational_bookings
  add column if not exists deduplication_key text;

-- Conserve les anciennes demandes dans l'historique, mais rattache la premiere
-- demande active de chaque client et creneau a une cle anti-doublon.
with ranked_bookings as (
  select
    id,
    user_id::text || ':slot:' || date_slot_id::text as deduplication_key,
    row_number() over (
      partition by user_id, date_slot_id
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.educational_bookings
  where user_id is not null
    and date_slot_id is not null
    and coalesce(status, '') not ilike 'annul%'
)
update public.educational_bookings as booking
set deduplication_key = ranked.deduplication_key
from ranked_bookings as ranked
where booking.id = ranked.id
  and ranked.duplicate_rank = 1;

-- Les anniversaires n'ont pas de creneau : la cle repose sur le client,
-- l'activite et la date demandee.
with ranked_birthdays as (
  select
    id,
    user_id::text || ':date:' || activity_id || ':' || booking_date::text as deduplication_key,
    row_number() over (
      partition by user_id, activity_id, booking_date
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.educational_bookings
  where user_id is not null
    and date_slot_id is null
    and booking_date is not null
    and coalesce(status, '') not ilike 'annul%'
)
update public.educational_bookings as booking
set deduplication_key = ranked.deduplication_key
from ranked_birthdays as ranked
where booking.id = ranked.id
  and ranked.duplicate_rank = 1
  and booking.deduplication_key is null;

create unique index if not exists educational_bookings_active_deduplication_uidx
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
  elsif new.user_id is not null and new.date_slot_id is not null then
    new.deduplication_key := new.user_id::text || ':slot:' || new.date_slot_id::text;
  elsif new.user_id is not null and new.booking_date is not null then
    new.deduplication_key := new.user_id::text || ':date:' || coalesce(new.activity_id, new.activity_type, '') || ':' || new.booking_date::text;
  else
    new.deduplication_key := null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_education_booking_deduplication_key_trigger
  on public.educational_bookings;
create trigger set_education_booking_deduplication_key_trigger
before insert or update of user_id, date_slot_id, activity_id, activity_type, booking_date, status
on public.educational_bookings
for each row execute function public.set_education_booking_deduplication_key();

-- Tous les produits autres que les oeufs doivent avoir un stock explicite.
update public.products
set stock_quantity = 0,
    updated_at = now()
where coalesce(size_eggs, 0) = 0
  and stock_quantity is null;

notify pgrst, 'reload schema';
