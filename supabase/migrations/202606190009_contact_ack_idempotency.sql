alter table public.contact_messages
  add column if not exists acknowledgement_processing_at timestamptz,
  add column if not exists acknowledged_at timestamptz;

-- Les anciens messages ont deja ete traites. Cela evite qu'un ancien
-- identifiant puisse relancer son accuse de reception.
update public.contact_messages
set acknowledged_at = coalesce(acknowledged_at, created_at)
where acknowledged_at is null;

alter table public.contact_messages
  drop constraint if exists contact_messages_full_name_length,
  drop constraint if exists contact_messages_email_length,
  drop constraint if exists contact_messages_phone_length,
  drop constraint if exists contact_messages_subject_length,
  drop constraint if exists contact_messages_message_length;

alter table public.contact_messages
  add constraint contact_messages_full_name_length
    check (char_length(full_name) between 1 and 150) not valid,
  add constraint contact_messages_email_length
    check (char_length(email) between 3 and 320) not valid,
  add constraint contact_messages_phone_length
    check (phone is null or char_length(phone) <= 50) not valid,
  add constraint contact_messages_subject_length
    check (subject is null or char_length(subject) <= 200) not valid,
  add constraint contact_messages_message_length
    check (char_length(message) between 1 and 5000) not valid;

create index if not exists contact_messages_acknowledged_at_idx
  on public.contact_messages (acknowledged_at, acknowledgement_processing_at);

notify pgrst, 'reload schema';
