# Les Poulettes du Marais

Application PWA de commande d'oeufs frais avec espace client, gestion du stock et tableau de bord admin.

## Commandes utiles

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

## Variables d'environnement

Copier `.env.example` vers `.env` si vous voulez configurer Supabase sans modifier le code.

```bash
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique
VITE_PUBLIC_SITE_URL=https://votre-site-en-ligne.fr
```

## Mise en ligne PWA

Pour Vercel, Netlify ou autre hebergeur statique :

- commande de build : `npm run build`
- dossier de sortie : `dist`
- variables a configurer : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` et `VITE_PUBLIC_SITE_URL`

Apres mise en ligne, verifier :

- la page d'accueil charge correctement
- `/manifest.webmanifest` repond bien
- `/sw.js` repond bien
- l'installation PWA est proposee par le navigateur
- les URLs de redirection Supabase incluent le domaine de production
- dans Supabase Auth > URL Configuration, le Site URL et les Redirect URLs utilisent le meme domaine que `VITE_PUBLIC_SITE_URL`

## Base de donnees Supabase

Avant d'utiliser la gestion admin des produits et prix, appliquer la migration :

```text
supabase/migrations/20260520_products_and_order_items.sql
```

Elle ajoute :

- la table `products`
- la colonne `orders.items`
- les produits oeufs par defaut
- les droits de lecture et de modification admin
