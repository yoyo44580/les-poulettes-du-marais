alter table public.dogs
  add column if not exists food_notes text,
  add column if not exists behavior_notes text,
  add column if not exists medical_notes text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;
