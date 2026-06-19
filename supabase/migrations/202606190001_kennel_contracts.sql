create table if not exists public.kennel_contracts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.kennel_bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  signer_name text not null default '',
  signature_data text not null default '',
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kennel_contracts enable row level security;

drop policy if exists "Clients read own kennel contracts" on public.kennel_contracts;
create policy "Clients read own kennel contracts"
on public.kennel_contracts for select to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Clients sign own kennel contracts" on public.kennel_contracts;
create policy "Clients sign own kennel contracts"
on public.kennel_contracts for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.kennel_bookings
    where kennel_bookings.id = booking_id and kennel_bookings.user_id = auth.uid()
  )
);

create or replace function public.prevent_signed_kennel_contract_changes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.signed_at is not null then
    raise exception 'signed_contract_is_immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kennel_contract_immutable on public.kennel_contracts;
create trigger kennel_contract_immutable
before update on public.kennel_contracts
for each row execute function public.prevent_signed_kennel_contract_changes();

create index if not exists kennel_contracts_user_id_idx on public.kennel_contracts(user_id);
create index if not exists kennel_contracts_booking_id_idx on public.kennel_contracts(booking_id);
