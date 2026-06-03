insert into public.site_settings (key, value)
values (
  'home_news',
  '{"items": []}'::jsonb
)
on conflict (key) do nothing;
