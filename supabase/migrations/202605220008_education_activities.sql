create table if not exists public.education_activities (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null default 0,
  season_label text not null default '',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.education_activities (
  id,
  name,
  description,
  price,
  season_label,
  active,
  sort_order
)
values
  (
    'farm-visit',
    'Visite de la ferme',
    'Rencontre avec les animaux et découverte du quotidien de la ferme.',
    0,
    'Toute l''année',
    true,
    10
  ),
  (
    'butter-workshop',
    'Atelier fabrication beurre',
    'Un atelier pratique pour fabriquer du beurre et comprendre les produits de la ferme.',
    0,
    'Selon saison',
    true,
    20
  ),
  (
    'birthday-group',
    'Groupes et anniversaires',
    'Une demande dédiée pour organiser une sortie sur mesure.',
    0,
    'Sur demande',
    true,
    30
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  season_label = excluded.season_label,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.education_activities enable row level security;

drop policy if exists "Education activities are readable" on public.education_activities;
create policy "Education activities are readable"
on public.education_activities
for select
using (true);

drop policy if exists "Admins can insert education activities" on public.education_activities;
create policy "Admins can insert education activities"
on public.education_activities
for insert
to authenticated
with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Admins can update education activities" on public.education_activities;
create policy "Admins can update education activities"
on public.education_activities
for update
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
)
with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Admins can delete education activities" on public.education_activities;
create policy "Admins can delete education activities"
on public.education_activities
for delete
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);
