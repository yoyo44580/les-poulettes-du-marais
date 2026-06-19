create table if not exists public.egg_production_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  eggs_collected integer not null check (eggs_collected >= 0),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists egg_production_logs_log_date_idx
  on public.egg_production_logs (log_date desc);

alter table public.egg_production_logs enable row level security;

drop policy if exists "Admins read egg production logs" on public.egg_production_logs;
create policy "Admins read egg production logs"
  on public.egg_production_logs
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

drop policy if exists "Admins manage egg production logs" on public.egg_production_logs;
create policy "Admins manage egg production logs"
  on public.egg_production_logs
  for all
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

drop function if exists public.upsert_egg_production_log(date, integer, text);

create or replace function public.upsert_egg_production_log(
  p_log_date date,
  p_eggs_collected integer,
  p_notes text default ''
)
returns public.egg_production_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_previous_quantity integer;
  v_delta integer;
  v_stock_id public.stock.id%type;
  v_current_stock integer;
  v_new_stock integer;
  v_result public.egg_production_logs;
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

  if p_log_date is null or p_eggs_collected is null or p_eggs_collected < 0 then
    raise exception 'invalid_egg_production_log';
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

  select eggs_collected
  into v_previous_quantity
  from public.egg_production_logs
  where log_date = p_log_date
  for update;

  v_delta := p_eggs_collected - coalesce(v_previous_quantity, 0);
  v_new_stock := v_current_stock + v_delta;

  if v_new_stock < 0 then
    raise exception 'stock_negative';
  end if;

  insert into public.egg_production_logs (
    log_date,
    eggs_collected,
    notes,
    created_by,
    updated_at
  )
  values (
    p_log_date,
    p_eggs_collected,
    coalesce(nullif(trim(p_notes), ''), ''),
    auth.uid(),
    now()
  )
  on conflict (log_date)
  do update set
    eggs_collected = excluded.eggs_collected,
    notes = excluded.notes,
    created_by = auth.uid(),
    updated_at = now()
  returning *
  into v_result;

  update public.stock
  set eggs_available = v_new_stock
  where id = v_stock_id;

  return v_result;
end;
$$;

grant execute on function public.upsert_egg_production_log(date, integer, text) to authenticated;
