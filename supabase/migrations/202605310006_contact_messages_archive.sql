alter table public.contact_messages
  add column if not exists archived_at timestamptz;

create index if not exists contact_messages_archived_at_idx
  on public.contact_messages (archived_at);
