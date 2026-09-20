create table if not exists public.farm_animals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null default 'Autre',
  breed text not null default '',
  sex text not null default '',
  birth_date date,
  microchip_number text not null default '',
  identification_number text not null default '',
  photo_url text not null default '',
  arrival_date date,
  status text not null default 'Présent',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farm_animal_health_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.farm_animals(id) on delete cascade,
  event_type text not null default 'other',
  event_date date not null default current_date,
  due_date date,
  title text not null,
  details text not null default '',
  veterinarian text not null default '',
  completed boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists farm_animals_species_idx
  on public.farm_animals (species);

create index if not exists farm_animals_status_idx
  on public.farm_animals (status);

create index if not exists farm_animal_health_events_animal_id_idx
  on public.farm_animal_health_events (animal_id);

create index if not exists farm_animal_health_events_due_date_idx
  on public.farm_animal_health_events (due_date);

alter table public.farm_animals enable row level security;
alter table public.farm_animal_health_events enable row level security;

drop policy if exists "Admins read farm animals" on public.farm_animals;
create policy "Admins read farm animals"
  on public.farm_animals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins insert farm animals" on public.farm_animals;
create policy "Admins insert farm animals"
  on public.farm_animals
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins update farm animals" on public.farm_animals;
create policy "Admins update farm animals"
  on public.farm_animals
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins delete farm animals" on public.farm_animals;
create policy "Admins delete farm animals"
  on public.farm_animals
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins read farm animal health events" on public.farm_animal_health_events;
create policy "Admins read farm animal health events"
  on public.farm_animal_health_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins insert farm animal health events" on public.farm_animal_health_events;
create policy "Admins insert farm animal health events"
  on public.farm_animal_health_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins update farm animal health events" on public.farm_animal_health_events;
create policy "Admins update farm animal health events"
  on public.farm_animal_health_events
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins delete farm animal health events" on public.farm_animal_health_events;
create policy "Admins delete farm animal health events"
  on public.farm_animal_health_events
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

create or replace function public.set_farm_animals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists farm_animals_updated_at_trigger on public.farm_animals;
create trigger farm_animals_updated_at_trigger
before update on public.farm_animals
for each row execute function public.set_farm_animals_updated_at();

drop trigger if exists farm_animal_health_events_updated_at_trigger on public.farm_animal_health_events;
create trigger farm_animal_health_events_updated_at_trigger
before update on public.farm_animal_health_events
for each row execute function public.set_farm_animals_updated_at();

notify pgrst, 'reload schema';
