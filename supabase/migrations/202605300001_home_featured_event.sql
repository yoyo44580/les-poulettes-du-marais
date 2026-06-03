insert into public.site_settings (key, value)
values (
  'home_featured_event',
  '{
    "enabled": true,
    "eyebrow": "Événement à l''honneur",
    "title": "Canicross aux Poulettes du Marais",
    "text": "Retour sur une belle matinée sportive et conviviale autour des chiens, des coureurs et de la ferme.",
    "image_url": "/images/pension-canine-1.jpg",
    "event_date": "",
    "event_details": "Le canicross des Poulettes du Marais est un rendez-vous convivial autour des chiens et de leurs humains. Vous pouvez retrouver ici les informations pratiques, les photos et les prochaines dates.",
    "gallery_images": "",
    "cta_label": "Voir l''événement",
    "cta_screen": "event"
  }'::jsonb
)
on conflict (key) do nothing;
