alter table public.education_activities
  add column if not exists gallery_images jsonb not null default '[]'::jsonb;
