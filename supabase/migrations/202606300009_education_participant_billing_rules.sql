create or replace function public.count_self_guided_visit_accompanist()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_farm_visit boolean;
begin
  if new.date_slot_id is null or jsonb_typeof(new.children) <> 'array' then
    return new;
  end if;

  v_is_farm_visit :=
    coalesce(new.activity_type, '') ilike '%autonom%'
    or (
      coalesce(new.activity_type, '') ilike '%visite%'
      and coalesce(new.activity_type, '') ilike '%ferme%'
    );

  new.participants := jsonb_array_length(new.children)
    + case when v_is_farm_visit and coalesce(trim(new.accompanist_name), '') <> '' then 1 else 0 end;

  return new;
end;
$$;

drop trigger if exists count_self_guided_visit_accompanist_trigger
  on public.educational_bookings;
create trigger count_self_guided_visit_accompanist_trigger
before insert or update of activity_type, date_slot_id, accompanist_name, children, participants
on public.educational_bookings
for each row execute function public.count_self_guided_visit_accompanist();

update public.educational_bookings
set participants = jsonb_array_length(children)
  + case
      when (
        coalesce(activity_type, '') ilike '%autonom%'
        or (
          coalesce(activity_type, '') ilike '%visite%'
          and coalesce(activity_type, '') ilike '%ferme%'
        )
      )
      and coalesce(trim(accompanist_name), '') <> ''
      then 1
      else 0
    end,
    updated_at = now()
where date_slot_id is not null
  and jsonb_typeof(children) = 'array';

notify pgrst, 'reload schema';
