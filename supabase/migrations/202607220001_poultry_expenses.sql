create table if not exists public.poultry_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  expense_type text not null default 'grain' check (expense_type in ('grain', 'hens')),
  amount numeric(10, 2) not null check (amount > 0),
  supplier text not null default '',
  quantity_label text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultry_expenses_expense_date_idx
  on public.poultry_expenses (expense_date desc);

create index if not exists poultry_expenses_expense_type_idx
  on public.poultry_expenses (expense_type);

alter table public.poultry_expenses enable row level security;

drop policy if exists "Admins read poultry expenses" on public.poultry_expenses;
create policy "Admins read poultry expenses"
  on public.poultry_expenses
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

drop policy if exists "Admins insert poultry expenses" on public.poultry_expenses;
create policy "Admins insert poultry expenses"
  on public.poultry_expenses
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

drop policy if exists "Admins update poultry expenses" on public.poultry_expenses;
create policy "Admins update poultry expenses"
  on public.poultry_expenses
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

drop policy if exists "Admins delete poultry expenses" on public.poultry_expenses;
create policy "Admins delete poultry expenses"
  on public.poultry_expenses
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

create or replace function public.set_poultry_expenses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists poultry_expenses_updated_at_trigger on public.poultry_expenses;
create trigger poultry_expenses_updated_at_trigger
before update on public.poultry_expenses
for each row
execute function public.set_poultry_expenses_updated_at();

notify pgrst, 'reload schema';
