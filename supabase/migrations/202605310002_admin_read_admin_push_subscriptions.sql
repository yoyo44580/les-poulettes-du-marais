drop policy if exists "Admins read admin push subscriptions" on public.admin_push_subscriptions;

create policy "Admins read admin push subscriptions"
on public.admin_push_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
