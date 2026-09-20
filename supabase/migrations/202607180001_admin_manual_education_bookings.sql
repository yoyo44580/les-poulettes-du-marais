alter table public.educational_bookings
  alter column user_id drop not null;

create or replace function public.create_admin_education_booking(
  p_date_slot_id uuid,
  p_client_name text,
  p_client_email text,
  p_phone text,
  p_accompanist_name text,
  p_participants integer,
  p_children jsonb default '[]'::jsonb,
  p_notes text default '',
  p_status text default 'Confirmée',
  p_amount_confirmed numeric default null,
  p_allow_over_capacity boolean default false
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
    coalesce(v_activity.name, 'Activité'),
    v_slot.activity_date,
    p_participants,
    btrim(p_accompanist_name),
    coalesce(p_children, '[]'::jsonb),
    btrim(p_client_name),
    coalesce(nullif(btrim(coalesce(p_client_email, '')), ''), 'hors-appli-ferme@les-poulettes.local'),
    btrim(p_phone),
    coalesce(btrim(p_notes), ''),
    coalesce(nullif(btrim(p_status), ''), 'Confirmée'),
    p_amount_confirmed
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_admin_education_booking(uuid, text, text, text, text, integer, jsonb, text, text, numeric, boolean) from public;
grant execute on function public.create_admin_education_booking(uuid, text, text, text, text, integer, jsonb, text, text, numeric, boolean) to authenticated;

notify pgrst, 'reload schema';
