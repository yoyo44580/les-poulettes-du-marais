create or replace function public.claim_client_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_subscription_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if nullif(trim(p_endpoint), '') is null
     or nullif(trim(p_p256dh), '') is null
     or nullif(trim(p_auth), '') is null then
    raise exception 'invalid_push_subscription';
  end if;

  insert into public.client_push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    updated_at
  )
  values (
    v_user_id,
    trim(p_endpoint),
    trim(p_p256dh),
    trim(p_auth),
    coalesce(p_user_agent, ''),
    now()
  )
  on conflict (endpoint)
  do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

revoke all on function public.claim_client_push_subscription(text, text, text, text) from public;
grant execute on function public.claim_client_push_subscription(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
