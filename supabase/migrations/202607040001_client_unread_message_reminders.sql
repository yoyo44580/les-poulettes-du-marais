alter table public.contact_message_replies
  add column if not exists client_read_at timestamptz,
  add column if not exists client_reminder_sent_at timestamptz;

create index if not exists contact_message_replies_client_unread_idx
  on public.contact_message_replies (created_at)
  where sender_role = 'admin' and client_read_at is null;

drop policy if exists "Clients mark admin replies as read" on public.contact_message_replies;
create policy "Clients mark admin replies as read"
on public.contact_message_replies
for update
to authenticated
using (
  sender_role = 'admin'
  and exists (
    select 1
    from public.contact_messages
    where contact_messages.id = contact_message_replies.contact_message_id
      and contact_messages.user_id = auth.uid()
  )
)
with check (
  sender_role = 'admin'
  and exists (
    select 1
    from public.contact_messages
    where contact_messages.id = contact_message_replies.contact_message_id
      and contact_messages.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
