insert into public.site_settings (key, value)
values (
  'occasional_sales',
  jsonb_build_object(
    'enabled', false,
    'eyebrow', 'Ponctuel',
    'title', 'Réservations du moment',
    'text', 'Retrouvez ici les ventes et animations proposées ponctuellement à la ferme.',
    'notice_text', 'Pensez à prévoir le nécessaire indiqué selon la réservation.',
    'image_url', '/images/marais.jpg',
    'items', jsonb_build_array(
      jsonb_build_object(
        'id', 'sound-journey-2026-08-11',
        'type', 'event',
        'name', 'Voyage sonore à la ferme',
        'description', 'Une parenthèse douce et conviviale avec un groupe d''artistes, au cœur de la ferme.',
        'price', 'Prix libre',
        'unit_label', 'place',
        'available_quantity', '11',
        'event_date', '2026-08-11',
        'event_time', '20:00',
        'practical_text', 'Pensez à apporter votre coussin, un plaid et un tapis pour profiter confortablement du voyage sonore.',
        'image_url', '',
        'active', false
      )
    )
  )
)
on conflict (key) do nothing;

update public.site_settings
set value = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        value,
        '{eyebrow}',
        to_jsonb(coalesce(nullif(value->>'eyebrow', ''), 'Ponctuel'))
      ),
      '{title}',
      to_jsonb(coalesce(nullif(value->>'title', ''), 'Réservations du moment'))
    ),
    '{text}',
    to_jsonb(coalesce(nullif(value->>'text', ''), 'Retrouvez ici les ventes et animations proposées ponctuellement à la ferme.'))
  ),
  '{items}',
  coalesce(value->'items', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'id', 'sound-journey-2026-08-11',
      'type', 'event',
      'name', 'Voyage sonore à la ferme',
      'description', 'Une parenthèse douce et conviviale avec un groupe d''artistes, au cœur de la ferme.',
      'price', 'Prix libre',
      'unit_label', 'place',
      'available_quantity', '11',
      'event_date', '2026-08-11',
      'event_time', '20:00',
      'practical_text', 'Pensez à apporter votre coussin, un plaid et un tapis pour profiter confortablement du voyage sonore.',
      'image_url', '',
      'active', false
    )
  )
)
where key = 'occasional_sales'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(value->'items', '[]'::jsonb)) item
    where item->>'id' = 'sound-journey-2026-08-11'
  );
