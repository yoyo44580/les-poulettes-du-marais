drop policy if exists "Clients read own occasional sale reservations" on public.occasional_sale_reservations;

create policy "Clients read own occasional sale reservations"
on public.occasional_sale_reservations
for select
to authenticated
using (
  lower(btrim(client_email)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
);
