alter table public.educational_bookings
  add column if not exists additional_accompanists jsonb not null default '[]'::jsonb;

comment on column public.educational_bookings.additional_accompanists is
  'Liste des accompagnateurs supplementaires pour les reservations ferme pedagogique.';

create or replace function public.count_self_guided_visit_accompanist()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_activity_name text := lower(coalesce(new.activity_type, ''));
  v_children_count integer := 0;
  v_additional_accompanist_count integer := 0;
  v_paid_accompanists boolean := false;
begin
  if new.date_slot_id is null then
    return new;
  end if;

  if jsonb_typeof(new.children) = 'array' then
    v_children_count := jsonb_array_length(new.children);
  end if;

  if jsonb_typeof(new.additional_accompanists) = 'array' then
    v_additional_accompanist_count := jsonb_array_length(new.additional_accompanists);
  else
    new.additional_accompanists := '[]'::jsonb;
  end if;

  v_paid_accompanists :=
    (v_activity_name like '%visite%' and v_activity_name like '%guid%')
    or (v_activity_name like '%rallye%' and v_activity_name like '%photo%');

  new.participants := v_children_count
    + case
        when v_paid_accompanists and coalesce(trim(new.accompanist_name), '') <> ''
          then 1 + v_additional_accompanist_count
        else 0
      end;

  return new;
end;
$$;

drop trigger if exists count_self_guided_visit_accompanist_trigger
  on public.educational_bookings;

create trigger count_self_guided_visit_accompanist_trigger
before insert or update of activity_type, date_slot_id, accompanist_name, additional_accompanists, children, participants
on public.educational_bookings
for each row execute function public.count_self_guided_visit_accompanist();

drop trigger if exists set_education_booking_deduplication_key_trigger
  on public.educational_bookings;

drop index if exists public.educational_bookings_active_deduplication_uidx;

create or replace function public.education_booking_people_signature(
  p_accompanist_name text,
  p_children jsonb,
  p_additional_accompanists jsonb default '[]'::jsonb
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
        lower(regexp_replace(trim(coalesce(accompanist.value, '')), '\s+', ' ', 'g')),
        '|'
        order by lower(regexp_replace(trim(coalesce(accompanist.value, '')), '\s+', ' ', 'g'))
      )
      from jsonb_array_elements_text(
        case when jsonb_typeof(p_additional_accompanists) = 'array' then p_additional_accompanists else '[]'::jsonb end
      ) as accompanist(value)
    ), '')
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
  p_children jsonb,
  p_additional_accompanists jsonb default '[]'::jsonb
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
      public.education_booking_people_signature(p_accompanist_name, p_children, p_additional_accompanists)
    when p_booking_date is not null then
      p_user_id::text || ':date:' || coalesce(p_activity_id, p_activity_type, '') || ':' ||
      p_booking_date::text || ':people:' ||
      public.education_booking_people_signature(p_accompanist_name, p_children, p_additional_accompanists)
    else null
  end;
$$;

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
      new.children,
      new.additional_accompanists
    );
  end if;

  return new;
end;
$$;

create trigger set_education_booking_deduplication_key_trigger
before insert or update of user_id, date_slot_id, activity_id, activity_type, booking_date, accompanist_name, additional_accompanists, children, status
on public.educational_bookings
for each row execute function public.set_education_booking_deduplication_key();

update public.educational_bookings
set participants = jsonb_array_length(case when jsonb_typeof(children) = 'array' then children else '[]'::jsonb end)
  + case
      when (
        lower(coalesce(activity_type, '')) like '%visite%'
        and lower(coalesce(activity_type, '')) like '%guid%'
      ) or (
        lower(coalesce(activity_type, '')) like '%rallye%'
        and lower(coalesce(activity_type, '')) like '%photo%'
      )
      then
        case when coalesce(trim(accompanist_name), '') <> '' then 1 else 0 end
        + jsonb_array_length(case when jsonb_typeof(additional_accompanists) = 'array' then additional_accompanists else '[]'::jsonb end)
      else 0
    end,
    updated_at = now()
where date_slot_id is not null;

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
      children,
      additional_accompanists
    ) as exact_key,
    row_number() over (
      partition by public.education_booking_exact_deduplication_key(
        user_id,
        date_slot_id,
        activity_id,
        activity_type,
        booking_date,
        accompanist_name,
        children,
        additional_accompanists
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

drop function if exists public.create_education_booking(text, uuid, text, date, integer, text, jsonb, text, text, text, text);

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
  p_notes text,
  p_additional_accompanists jsonb default '[]'::jsonb
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
  v_is_treasure_hunt boolean :=
    coalesce(p_activity_type, '') ilike '%jeu de piste%'
    or coalesce(p_activity_id, '') ilike '%piste%';
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_participants is null or p_participants < 1 then
    raise exception 'invalid_participants' using errcode = '22023';
  end if;

  if v_is_treasure_hunt and p_participants < 3 then
    raise exception 'education_minimum_three_participants' using errcode = 'P0001';
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

  if not v_is_treasure_hunt then
    select coalesce(sum(participants), 0)
    into v_booked
    from public.educational_bookings
    where date_slot_id = p_date_slot_id
      and coalesce(status, '') not ilike 'annul%';

    if v_booked + p_participants > v_slot.capacity then
      raise exception 'education_slot_full' using errcode = 'P0001';
    end if;
  end if;

  insert into public.educational_bookings (
    user_id,
    activity_id,
    date_slot_id,
    activity_type,
    booking_date,
    participants,
    accompanist_name,
    additional_accompanists,
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
    coalesce(p_additional_accompanists, '[]'::jsonb),
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

revoke all on function public.create_education_booking(text, uuid, text, date, integer, text, jsonb, text, text, text, text, jsonb) from public;
grant execute on function public.create_education_booking(text, uuid, text, date, integer, text, jsonb, text, text, text, text, jsonb) to authenticated;

drop function if exists public.create_admin_education_booking(uuid, text, text, text, text, integer, jsonb, text, text, numeric, boolean);

create or replace function public.create_admin_education_booking(
  p_date_slot_id uuid,
  p_client_name text,
  p_client_email text,
  p_phone text,
  p_accompanist_name text,
  p_participants integer,
  p_children jsonb default '[]'::jsonb,
  p_notes text default '',
  p_status text default 'Confirmee',
  p_amount_confirmed numeric default null,
  p_allow_over_capacity boolean default false,
  p_additional_accompanists jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_slot public.education_activity_dates%rowtype;
  v_activity public.education_activities%rowtype;
  v_booked integer := 0;
  v_booking_id uuid;
  v_is_treasure_hunt boolean := false;
begin
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
  into v_is_admin;

  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required';
  end if;

  if p_date_slot_id is null then
    raise exception 'education_slot_unavailable';
  end if;

  if nullif(btrim(coalesce(p_client_name, '')), '') is null then
    raise exception 'client_name_required';
  end if;

  if nullif(btrim(coalesce(p_phone, '')), '') is null then
    raise exception 'phone_required';
  end if;

  if nullif(btrim(coalesce(p_accompanist_name, '')), '') is null then
    raise exception 'accompanist_required';
  end if;

  if p_participants is null or p_participants < 1 then
    raise exception 'invalid_participants';
  end if;

  select *
  into v_slot
  from public.education_activity_dates
  where id = p_date_slot_id
  for update;

  if not found or v_slot.active is false then
    raise exception 'education_slot_unavailable';
  end if;

  select *
  into v_activity
  from public.education_activities
  where id = v_slot.activity_id;

  v_is_treasure_hunt :=
    coalesce(v_activity.name, '') ilike '%jeu de piste%'
    or coalesce(v_activity.id, '') ilike '%piste%';

  if v_is_treasure_hunt and p_participants < 3 then
    raise exception 'education_minimum_three_participants';
  end if;

  if not coalesce(p_allow_over_capacity, false) and not v_is_treasure_hunt then
    select coalesce(sum(participants), 0)
    into v_booked
    from public.educational_bookings
    where date_slot_id = p_date_slot_id
      and coalesce(status, '') not ilike 'annul%';

    if v_booked + p_participants > v_slot.capacity then
      raise exception 'education_slot_full';
    end if;
  end if;

  insert into public.educational_bookings (
    user_id,
    activity_id,
    date_slot_id,
    activity_type,
    booking_date,
    participants,
    accompanist_name,
    additional_accompanists,
    children,
    client_name,
    client_email,
    phone,
    notes,
    status,
    amount_confirmed
  )
  values (
    null,
    v_slot.activity_id,
    v_slot.id,
    coalesce(v_activity.name, 'Activite'),
    v_slot.activity_date,
    p_participants,
    btrim(p_accompanist_name),
    coalesce(p_additional_accompanists, '[]'::jsonb),
    coalesce(p_children, '[]'::jsonb),
    btrim(p_client_name),
    coalesce(nullif(btrim(coalesce(p_client_email, '')), ''), 'hors-appli-ferme@les-poulettes.local'),
    btrim(p_phone),
    coalesce(btrim(p_notes), ''),
    coalesce(nullif(btrim(p_status), ''), 'Confirmee'),
    p_amount_confirmed
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_admin_education_booking(uuid, text, text, text, text, integer, jsonb, text, text, numeric, boolean, jsonb) from public;
grant execute on function public.create_admin_education_booking(uuid, text, text, text, text, integer, jsonb, text, text, numeric, boolean, jsonb) to authenticated;

notify pgrst, 'reload schema';
