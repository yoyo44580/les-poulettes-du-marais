create table if not exists public.contact_message_replies (
  id uuid primary key default gen_random_uuid(),
  contact_message_id uuid not null references public.contact_messages(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null default 'client' check (sender_role in ('client', 'admin')),
  sender_name text,
  sender_email text,
  message text not null check (char_length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages
  add column if not exists last_reply_at timestamptz,
  add column if not exists last_reply_by text check (last_reply_by is null or last_reply_by in ('client', 'admin'));

create index if not exists contact_message_replies_message_created_idx
  on public.contact_message_replies (contact_message_id, created_at);

create index if not exists contact_messages_user_created_idx
  on public.contact_messages (user_id, created_at desc);

alter table public.contact_message_replies enable row level security;

drop policy if exists "Clients read their contact messages" on public.contact_messages;
create policy "Clients read their contact messages"
on public.contact_messages
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Clients update their active contact messages" on public.contact_messages;

drop policy if exists "Clients and admins read contact replies" on public.contact_message_replies;
create policy "Clients and admins read contact replies"
on public.contact_message_replies
for select
to authenticated
using (
  exists (
    select 1
    from public.contact_messages
    where contact_messages.id = contact_message_replies.contact_message_id
      and contact_messages.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Clients and admins create contact replies" on public.contact_message_replies;
create policy "Clients and admins create contact replies"
on public.contact_message_replies
for insert
to authenticated
with check (
  (
    sender_role = 'client'
    and sender_user_id = auth.uid()
    and exists (
      select 1
      from public.contact_messages
      where contact_messages.id = contact_message_replies.contact_message_id
        and contact_messages.user_id = auth.uid()
    )
  )
  or (
    sender_role = 'admin'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  )
);

create or replace function public.sync_contact_message_after_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contact_messages
  set
    status = case
      when new.sender_role = 'admin' and status = 'Nouveau' then 'En cours'
      else status
    end,
    archived_at = null,
    last_reply_at = new.created_at,
    last_reply_by = new.sender_role,
    updated_at = new.created_at
  where id = new.contact_message_id;

  if new.sender_role = 'client' then
    insert into public.admin_action_logs (
      action_type,
      title,
      target_type,
      target_id,
      target_label,
      details,
      created_by,
      created_by_email
    )
    select
      'notification_contact_reply',
      'Nouvelle réponse client',
      'Message',
      cm.id,
      coalesce(cm.full_name, cm.email, 'Message client'),
      jsonb_build_object('sujet', coalesce(cm.subject, ''), 'email', coalesce(cm.email, '')),
      null,
      coalesce(new.sender_email, cm.email, '')
    from public.contact_messages cm
    where cm.id = new.contact_message_id;
  end if;

  return new;
end;
$$;

drop trigger if exists contact_message_replies_sync_trigger on public.contact_message_replies;
create trigger contact_message_replies_sync_trigger
after insert on public.contact_message_replies
for each row
execute function public.sync_contact_message_after_reply();

notify pgrst, 'reload schema';
