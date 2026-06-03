insert into public.site_settings (key, value)
values (
  'kennel_page',
  '{
    "image_url": "/images/pension-canine-1.jpg",
    "gallery_images": "/images/pension-canine-1.jpg\n/images/pension-canine-2.jpg\n/images/pension-canine-3.jpg"
  }'::jsonb
)
on conflict (key) do nothing;
