update public.education_activities
set price = 50,
    updated_at = now()
where coalesce(id, '') ilike '%piste%'
   or coalesce(name, '') ilike '%jeu de piste%';

notify pgrst, 'reload schema';
