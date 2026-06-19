alter table public.dogs
  add column if not exists microchip_number text not null default '',
  add column if not exists is_microchipped boolean not null default true;

create index if not exists dogs_microchip_number_idx
  on public.dogs (microchip_number)
  where microchip_number <> '';
