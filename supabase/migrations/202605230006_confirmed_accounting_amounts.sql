alter table public.educational_bookings
  add column if not exists amount_confirmed numeric(10, 2);

alter table public.kennel_bookings
  add column if not exists amount_confirmed numeric(10, 2);

drop policy if exists "Clients manage own educational bookings" on public.educational_bookings;
drop policy if exists "Clients and admins read educational bookings" on public.educational_bookings;
drop policy if exists "Clients insert own educational bookings" on public.educational_bookings;
drop policy if exists "Admins update educational bookings" on public.educational_bookings;
drop policy if exists "Admins delete educational bookings" on public.educational_bookings;

create policy "Clients and admins read educational bookings"
on public.educational_bookings
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

create policy "Clients insert own educational bookings"
on public.educational_bookings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Admins update educational bookings"
on public.educational_bookings
for update
to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create policy "Admins delete educational bookings"
on public.educational_bookings
for delete
to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "Clients manage own kennel bookings" on public.kennel_bookings;
drop policy if exists "Clients and admins read kennel bookings" on public.kennel_bookings;
drop policy if exists "Clients insert own kennel bookings" on public.kennel_bookings;
drop policy if exists "Admins update kennel bookings" on public.kennel_bookings;
drop policy if exists "Admins delete kennel bookings" on public.kennel_bookings;

create policy "Clients and admins read kennel bookings"
on public.kennel_bookings
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

create policy "Clients insert own kennel bookings"
on public.kennel_bookings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Admins update kennel bookings"
on public.kennel_bookings
for update
to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create policy "Admins delete kennel bookings"
on public.kennel_bookings
for delete
to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true));
