create table if not exists public.site_traffic_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('page_view', 'click')),
  page_key text not null,
  page_label text not null,
  visitor_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_traffic_events_created_at_idx
  on public.site_traffic_events (created_at desc);

create index if not exists site_traffic_events_page_key_idx
  on public.site_traffic_events (page_key);

alter table public.site_traffic_events enable row level security;

drop policy if exists "Anyone can add anonymous traffic events" on public.site_traffic_events;
create policy "Anyone can add anonymous traffic events"
  on public.site_traffic_events
  for insert
  with check (true);

drop policy if exists "Admins can read traffic events" on public.site_traffic_events;
create policy "Admins can read traffic events"
  on public.site_traffic_events
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
