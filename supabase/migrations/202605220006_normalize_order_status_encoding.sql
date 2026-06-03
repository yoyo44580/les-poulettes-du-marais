update public.orders
set status = case
  when status in ('Ã€ prÃ©parer') then 'À préparer'
  when status in ('PrÃªte') then 'Prête'
  when status in ('LivrÃ©e', 'RÃ©cupÃ©rÃ©e', 'Récupérée') then 'Livrée'
  when status in ('AnnulÃ©e') then 'Annulée'
  else status
end
where status in (
  'Ã€ prÃ©parer',
  'PrÃªte',
  'LivrÃ©e',
  'RÃ©cupÃ©rÃ©e',
  'Récupérée',
  'AnnulÃ©e'
);
