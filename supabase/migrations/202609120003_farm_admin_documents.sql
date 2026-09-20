alter table public.farm_animal_documents
  alter column animal_id drop not null;

create index if not exists farm_animal_documents_admin_documents_idx
  on public.farm_animal_documents (document_date desc, created_at desc)
  where animal_id is null;

notify pgrst, 'reload schema';
