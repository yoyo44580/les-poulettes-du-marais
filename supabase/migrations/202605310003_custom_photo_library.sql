insert into public.site_settings (key, value)
values (
  'custom_photo_library',
  '{"images": ""}'::jsonb
)
on conflict (key) do nothing;
