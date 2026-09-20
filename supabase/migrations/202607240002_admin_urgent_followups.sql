insert into public.site_settings (key, value)
values ('automation_settings', '{"admin_urgent_followups": true}'::jsonb)
on conflict (key) do update
set value = case
  when public.site_settings.value ? 'admin_urgent_followups' then public.site_settings.value
  else coalesce(public.site_settings.value, '{}'::jsonb) || '{"admin_urgent_followups": true}'::jsonb
end;
