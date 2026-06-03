alter table public.dogs
  add column if not exists sterilized boolean not null default false;
