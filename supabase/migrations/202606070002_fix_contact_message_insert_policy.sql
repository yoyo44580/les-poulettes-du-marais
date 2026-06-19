alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can create contact messages" on public.contact_messages;
create policy "Anyone can create contact messages"
on public.contact_messages
for insert
to anon, authenticated
with check (true);
