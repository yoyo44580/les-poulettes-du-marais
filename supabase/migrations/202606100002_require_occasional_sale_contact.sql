update public.occasional_sale_reservations
set client_email = 'non-renseigne@example.local'
where client_email is null or btrim(client_email) = '';

update public.occasional_sale_reservations
set phone = 'Non renseigné'
where phone is null or btrim(phone) = '';

alter table public.occasional_sale_reservations
  alter column client_email set not null,
  alter column phone set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'occasional_sale_reservations_client_email_required'
  ) then
    alter table public.occasional_sale_reservations
      add constraint occasional_sale_reservations_client_email_required
      check (btrim(client_email) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'occasional_sale_reservations_phone_required'
  ) then
    alter table public.occasional_sale_reservations
      add constraint occasional_sale_reservations_phone_required
      check (btrim(phone) <> '');
  end if;
end $$;

drop policy if exists "Anyone can create occasional sale reservations" on public.occasional_sale_reservations;
create policy "Anyone can create occasional sale reservations"
on public.occasional_sale_reservations
for insert
to anon, authenticated
with check (
  client_name is not null
  and btrim(client_name) <> ''
  and client_email is not null
  and btrim(client_email) <> ''
  and phone is not null
  and btrim(phone) <> ''
  and item_id is not null
  and item_name is not null
  and quantity > 0
);
