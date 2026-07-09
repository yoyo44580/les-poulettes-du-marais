create or replace function public.count_self_guided_visit_accompanist()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.activity_type, '') ilike '%autonom%'
     and coalesce(trim(new.accompanist_name), '') <> ''
     and jsonb_typeof(new.children) = 'array' then
    new.participants := jsonb_array_length(new.children) + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists count_self_guided_visit_accompanist_trigger
  on public.educational_bookings;
create trigger count_self_guided_visit_accompanist_trigger
before insert or update of activity_type, accompanist_name, children, participants
on public.educational_bookings
for each row execute function public.count_self_guided_visit_accompanist();

-- Corrige les anciennes visites en autonomie lorsque seul le nombre
-- d'enfants avait ete enregistre.
update public.educational_bookings
set participants = jsonb_array_length(children) + 1,
    updated_at = now()
where coalesce(activity_type, '') ilike '%autonom%'
  and coalesce(trim(accompanist_name), '') <> ''
  and jsonb_typeof(children) = 'array'
  and participants = jsonb_array_length(children);

notify pgrst, 'reload schema';
