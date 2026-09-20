create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('admin-urgent-followups-daily')
where exists (
  select 1
  from cron.job
  where jobname = 'admin-urgent-followups-daily'
);

select cron.schedule(
  'admin-urgent-followups-daily',
  '30 6 * * *',
  $$
  select
    net.http_post(
      url := 'https://iomagmnnazaidtmivayo.supabase.co/functions/v1/send-admin-urgent-followups',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'ADMIN_URGENT_FOLLOWUP_SECRET'
          limit 1
        )
      ),
      body := jsonb_build_object('triggerSource', 'scheduled')
    );
  $$
);
