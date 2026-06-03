update public.orders
set status = 'Livrée'
where status in ('Récupérée', 'Récupérée');


