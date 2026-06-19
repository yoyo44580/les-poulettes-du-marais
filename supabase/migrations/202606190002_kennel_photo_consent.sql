alter table public.kennel_bookings
  add column if not exists photo_consent boolean;

comment on column public.kennel_bookings.photo_consent is
  'Choix explicite du client concernant l utilisation des photos et videos de son chien.';
