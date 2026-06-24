alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.update_customer_contact_info(
  p_profile_id uuid,
  p_phone text,
  p_delivery_address text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  update public.profiles
  set
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    address_previous_value = case
      when coalesce(delivery_address, '') <> coalesce(btrim(p_delivery_address), '')
      then delivery_address
      else address_previous_value
    end,
    delivery_address = nullif(btrim(coalesce(p_delivery_address, '')), ''),
    address_validation_status = case
      when coalesce(delivery_address, '') <> coalesce(btrim(p_delivery_address), '')
      then 'review'
      else address_validation_status
    end,
    address_validation_suggestion = case
      when coalesce(delivery_address, '') <> coalesce(btrim(p_delivery_address), '')
      then null
      else address_validation_suggestion
    end,
    address_validation_score = case
      when coalesce(delivery_address, '') <> coalesce(btrim(p_delivery_address), '')
      then null
      else address_validation_score
    end,
    address_validation_checked_at = case
      when coalesce(delivery_address, '') <> coalesce(btrim(p_delivery_address), '')
      then null
      else address_validation_checked_at
    end,
    updated_at = now()
  where id = p_profile_id;
end;
$$;

revoke all on function public.update_customer_contact_info(uuid, text, text) from public;
grant execute on function public.update_customer_contact_info(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
