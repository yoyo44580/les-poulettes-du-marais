drop policy if exists "Admins insert kennel bookings" on public.kennel_bookings;

create policy "Admins insert kennel bookings"
on public.kennel_bookings
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

notify pgrst, 'reload schema';
