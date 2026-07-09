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

notify pgrst, 'reload schema';
