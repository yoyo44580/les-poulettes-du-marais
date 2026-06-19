alter table public.kennel_bookings
  add column if not exists client_insurance text;

comment on column public.kennel_bookings.client_insurance is
  'Compagnie d assurance renseignee par le proprietaire du chien.';
