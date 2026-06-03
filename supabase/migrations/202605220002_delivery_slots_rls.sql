alter table public.delivery_slots enable row level security;

drop policy if exists "Delivery slots are readable" on public.delivery_slots;
create policy "Delivery slots are readable"
on public.delivery_slots
for select
using (true);

drop policy if exists "Admins can insert delivery slots" on public.delivery_slots;
create policy "Admins can insert delivery slots"
on public.delivery_slots
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Admins can update delivery slots" on public.delivery_slots;
create policy "Admins can update delivery slots"
on public.delivery_slots
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Admins can delete delivery slots" on public.delivery_slots;
create policy "Admins can delete delivery slots"
on public.delivery_slots
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
