alter table public.kennel_bookings
  add column if not exists discount_percent numeric(5, 2) not null default 0
  check (discount_percent >= 0 and discount_percent <= 100);

comment on column public.kennel_bookings.discount_percent is
  'Remise commerciale appliquée au montant de cette réservation pension.';

create or replace function public.create_client_multi_dog_kennel_booking(
  p_start_date date,
  p_end_date date,
  p_arrival_time time without time zone,
  p_departure_time time without time zone,
  p_client_name text,
  p_client_email text,
  p_phone text,
  p_client_insurance text,
  p_photo_consent boolean,
  p_amount_confirmed numeric,
  p_notes text,
  p_dogs jsonb
)
returns table (booking_id uuid, dog_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_authenticated_email text := nullif(auth.jwt() ->> 'email', '');
  v_dog jsonb;
  v_dog_id uuid;
  v_booking_id uuid;
  v_not_microchipped boolean;
  v_dog_position integer := 0;
  v_discount_percent numeric(5, 2);
  v_booking_amount numeric;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'kennel_invalid_dates' using errcode = '22023';
  end if;

  if p_arrival_time is null or p_departure_time is null then
    raise exception 'kennel_times_required' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_client_insurance, '')), '') is null then
    raise exception 'kennel_insurance_required' using errcode = '22023';
  end if;

  if jsonb_typeof(p_dogs) is distinct from 'array'
     or jsonb_array_length(p_dogs) < 1
     or jsonb_array_length(p_dogs) > 4 then
    raise exception 'kennel_dog_count_invalid' using errcode = '22023';
  end if;

  for v_dog in select value from jsonb_array_elements(p_dogs)
  loop
    v_dog_position := v_dog_position + 1;
    v_discount_percent := case when v_dog_position = 2 then 10 else 0 end;
    v_booking_amount := case
      when p_amount_confirmed is null then null
      else round(p_amount_confirmed * (1 - v_discount_percent / 100), 2)
    end;

    if nullif(btrim(coalesce(v_dog ->> 'name', '')), '') is null then
      raise exception 'kennel_dog_name_required' using errcode = '22023';
    end if;

    v_not_microchipped := coalesce((v_dog ->> 'notMicrochipped')::boolean, false);

    if not v_not_microchipped
       and nullif(btrim(coalesce(v_dog ->> 'microchipNumber', '')), '') is null then
      raise exception 'kennel_dog_microchip_required' using errcode = '22023';
    end if;

    insert into public.dogs (
      user_id,
      name,
      photo_url,
      breed,
      birth_year,
      sex,
      microchip_number,
      is_microchipped,
      vaccines_up_to_date,
      sterilized,
      veterinarian_name,
      notes
    ) values (
      v_user_id,
      btrim(v_dog ->> 'name'),
      nullif(btrim(coalesce(v_dog ->> 'photoUrl', '')), ''),
      nullif(btrim(coalesce(v_dog ->> 'breed', '')), ''),
      nullif(v_dog ->> 'birthYear', '')::integer,
      nullif(btrim(coalesce(v_dog ->> 'sex', '')), ''),
      case when v_not_microchipped then '' else btrim(v_dog ->> 'microchipNumber') end,
      not v_not_microchipped,
      coalesce((v_dog ->> 'vaccinesUpToDate')::boolean, false),
      coalesce((v_dog ->> 'sterilized')::boolean, false),
      nullif(btrim(coalesce(v_dog ->> 'veterinarianName', '')), ''),
      nullif(btrim(coalesce(v_dog ->> 'notes', '')), '')
    )
    returning id into v_dog_id;

    insert into public.kennel_bookings (
      user_id,
      dog_id,
      start_date,
      end_date,
      arrival_time,
      departure_time,
      client_name,
      client_email,
      phone,
      client_insurance,
      photo_consent,
      amount_confirmed,
      discount_percent,
      notes
    ) values (
      v_user_id,
      v_dog_id,
      p_start_date,
      p_end_date,
      p_arrival_time,
      p_departure_time,
      coalesce(nullif(btrim(p_client_name), ''), v_authenticated_email, 'Client'),
      coalesce(v_authenticated_email, nullif(btrim(p_client_email), ''), ''),
      nullif(btrim(coalesce(p_phone, '')), ''),
      btrim(p_client_insurance),
      coalesce(p_photo_consent, false),
      v_booking_amount,
      v_discount_percent,
      coalesce(nullif(btrim(coalesce(v_dog ->> 'notes', '')), ''), nullif(btrim(coalesce(p_notes, '')), ''))
    )
    returning id into v_booking_id;

    booking_id := v_booking_id;
    dog_id := v_dog_id;
    return next;
  end loop;
end;
$$;

revoke all on function public.create_client_multi_dog_kennel_booking(
  date,
  date,
  time without time zone,
  time without time zone,
  text,
  text,
  text,
  text,
  boolean,
  numeric,
  text,
  jsonb
) from public, anon;

grant execute on function public.create_client_multi_dog_kennel_booking(
  date,
  date,
  time without time zone,
  time without time zone,
  text,
  text,
  text,
  text,
  boolean,
  numeric,
  text,
  jsonb
) to authenticated;

notify pgrst, 'reload schema';
