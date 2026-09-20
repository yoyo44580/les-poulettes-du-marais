create table if not exists public.egg_donation_logs (
  id uuid primary key default gen_random_uuid(),
  donation_date date not null,
  eggs_donated integer not null check (eggs_donated > 0),
  recipient text not null default '',
  reason text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists egg_donation_logs_donation_date_idx
  on public.egg_donation_logs (donation_date desc);

alter table public.egg_donation_logs enable row level security;

drop policy if exists "Admins read egg donation logs" on public.egg_donation_logs;
create policy "Admins read egg donation logs"
  on public.egg_donation_logs
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

drop policy if exists "Admins insert egg donation logs" on public.egg_donation_logs;
create policy "Admins insert egg donation logs"
  on public.egg_donation_logs
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

drop function if exists public.insert_egg_donation_log(date, integer, text, text, text);

create or replace function public.insert_egg_donation_log(
  p_donation_date date,
  p_eggs_donated integer,
  p_recipient text default '',
  p_reason text default '',
  p_notes text default ''
)
returns public.egg_donation_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_stock_id public.stock.id%type;
  v_current_stock integer;
  v_new_stock integer;
  v_result public.egg_donation_logs;
begin
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
  into v_is_admin;

  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required';
  end if;

  if p_donation_date is null or p_eggs_donated is null or p_eggs_donated <= 0 then
    raise exception 'invalid_egg_donation_log';
  end if;

  select id, eggs_available
  into v_stock_id, v_current_stock
  from public.stock
  order by id asc
  limit 1
  for update;

  if v_stock_id is null then
    raise exception 'stock_not_found';
  end if;

  v_new_stock := v_current_stock - p_eggs_donated;

  if v_new_stock < 0 then
    raise exception 'stock_negative';
  end if;

  insert into public.egg_donation_logs (
    donation_date,
    eggs_donated,
    recipient,
    reason,
    notes,
    created_by
  )
  values (
    p_donation_date,
    p_eggs_donated,
    coalesce(nullif(trim(p_recipient), ''), ''),
    coalesce(nullif(trim(p_reason), ''), ''),
    coalesce(nullif(trim(p_notes), ''), ''),
    auth.uid()
  )
  returning *
  into v_result;

  update public.stock
  set eggs_available = v_new_stock
  where id = v_stock_id;

  return v_result;
end;
$$;

grant execute on function public.insert_egg_donation_log(date, integer, text, text, text) to authenticated;

notify pgrst, 'reload schema';
