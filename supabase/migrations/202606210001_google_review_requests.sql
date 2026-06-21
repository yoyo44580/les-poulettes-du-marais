create table if not exists public.google_review_requests (
  id uuid primary key default gen_random_uuid(),
  booking_type text not null check (booking_type in ('education', 'kennel')),
  booking_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  client_email text not null,
  completion_date date not null,
  email_sent boolean not null default false,
  push_sent boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (booking_type, booking_id)
);

alter table public.google_review_requests enable row level security;

drop policy if exists "Admins read Google review requests" on public.google_review_requests;
create policy "Admins read Google review requests"
on public.google_review_requests for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create index if not exists google_review_requests_completion_date_idx
  on public.google_review_requests (completion_date desc);

insert into public.site_settings (key, value)
values ('google_review_automation_started_on', to_jsonb(current_date::text))
on conflict (key) do nothing;

notify pgrst, 'reload schema';
