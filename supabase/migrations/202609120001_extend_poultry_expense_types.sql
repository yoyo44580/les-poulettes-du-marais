alter table public.poultry_expenses
  drop constraint if exists poultry_expenses_expense_type_check;

alter table public.poultry_expenses
  add constraint poultry_expenses_expense_type_check
  check (expense_type in ('grain', 'hens', 'veterinary', 'other'));
