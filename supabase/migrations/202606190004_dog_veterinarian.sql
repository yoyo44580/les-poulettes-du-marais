alter table public.dogs
  add column if not exists veterinarian_name text;

comment on column public.dogs.veterinarian_name is
  'Nom du veterinaire habituel ou de la clinique veterinaire du chien.';
