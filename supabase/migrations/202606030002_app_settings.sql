insert into public.site_settings (key, value)
values (
  'app_settings',
  '{
    "farm_name": "Les Poulettes du Marais",
    "contact_email": "",
    "contact_phone": "",
    "site_url": "",
    "google_review_url": "https://g.page/r/CSmAsTCUXluPEBM/review",
    "google_maps_url": "https://www.google.com/maps/search/?api=1&query=Les%20Poulettes%20du%20Marais%20Bourneuf-en-Retz",
    "kennel_capacity_note": "4 chiens par jour",
    "admin_note": ""
  }'::jsonb
)
on conflict (key) do nothing;
