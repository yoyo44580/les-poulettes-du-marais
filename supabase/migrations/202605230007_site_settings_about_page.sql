create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

insert into public.site_settings (key, value)
values (
  'about_page',
  '{
    "image_url": "/images/marais.jpg",
    "gallery_images": "",
    "eyebrow": "Les Poulettes du Marais",
    "title": "Une ferme familiale au rythme du marais",
    "intro": "Ici, les journées se construisent autour des animaux, des saisons et du lien avec les familles qui viennent chercher leurs œufs, découvrir la ferme ou confier leur chien le temps d''un séjour.",
    "block1_title": "Notre quotidien",
    "block1_text": "Les Poulettes du Marais réunit trois activités complémentaires : la vente d''œufs frais, la ferme pédagogique et la pension canine. L''idée est simple : proposer un lieu vivant, accueillant et proche des gens, où chaque activité garde une dimension humaine.",
    "block2_title": "Ce que vous trouverez ici",
    "block2_text": "Des œufs frais à commander en ligne pour les clients fidèles.\nDes ateliers et visites pour découvrir les animaux et les gestes de la ferme.\nUne pension canine avec suivi des disponibilités et fiche chien complète.",
    "block3_title": "Notre esprit",
    "block3_text": "Nous avançons avec le souci du bien-être animal, du contact simple et de l''organisation claire. Cette application sert justement à rendre les commandes et réservations plus faciles, tout en gardant un fonctionnement chaleureux."
  }'::jsonb
)
on conflict (key) do nothing;

drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings"
on public.site_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings"
on public.site_settings
for all
to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true));
