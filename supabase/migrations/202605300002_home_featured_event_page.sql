update public.site_settings
set value = value
  || '{
    "event_date": "",
    "event_details": "Le canicross des Poulettes du Marais est un rendez-vous convivial autour des chiens et de leurs humains. Vous pouvez retrouver ici les informations pratiques, les photos et les prochaines dates.",
    "gallery_images": "",
    "cta_label": "Voir l''événement",
    "cta_screen": "event"
  }'::jsonb,
  updated_at = now()
where key = 'home_featured_event';
