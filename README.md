# Milo · Orbia Systems

Version 0.2 — atelier local, non connecté, non destiné aux données réelles de production.

## Essayer immédiatement

Ouvrir `deliverables/Milo.html` dans un navigateur récent. L'application est embarquée dans un seul fichier, sans téléchargement réseau. Le stockage IndexedDB doit être autorisé. Le comportement des fichiers locaux dépend du navigateur : si celui-ci refuse le stockage, lancer le projet en HTTP avec la commande de développement ci-dessous. L'atelier commence vide ; le bouton « Essayer avec un exemple de cookie » charge un jeu fictif explicite.

Les données restent sur cet appareil, pour cette origine de navigateur. Elles ne sont ni partagées entre utilisateurs ni sauvegardées dans Supabase. Exporter régulièrement le JSON dans Réglages. Un déplacement du fichier HTML ou un changement de navigateur peut changer l'espace de stockage accessible.

## Fonctionnalités implémentées

- Fournisseurs : création, modification, archivage contrôlé, contact et délai.
- Articles : ingrédients, emballages, revente, consommables, catégorie, unité, allergènes, référence interne.
- Références d'achat multiples par article : fournisseur, contenu, conditionnement imbriqué à deux niveaux, prix HT et minimum de commande.
- Sélection explicite de la référence de coût quand plusieurs références existent.
- Recettes : ingrédients, emballages, sous-recettes, rendement en portions, pertes techniques, temps et coût horaire.
- Coûts matière, emballage, main-d'œuvre, total et par portion ; prix conseillé HT/TTC, TVA, taux matière cible et arrondi commercial.
- Changement de prix répercuté sur les recettes ; coûts datés figés séparément.
- Recherche, filtres d'articles, historique de modifications, export et restauration validée.
- Sauvegardes IndexedDB avec vérification atomique de révision pour éviter les écrasements entre fenêtres.
- Interface française, menu repliable et mise en page adaptative.

## Installer le code

Node.js >= 22.13 et pnpm 11.25.0 (version déclarée dans `package.json`). Les versions exactes résolues figurent dans `pnpm-lock.yaml` ; conserver ce lockfile.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run dev:next
```

Ouvrir l'adresse indiquée par Next.js. Pour l'environnement de développement ChatGPT, le starter conserve aussi `pnpm run dev` (aperçu Vinext supervisé).

```sh
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build:next
pnpm run build:offline
```

`pnpm run build` conserve la compilation de l'environnement fourni. `build:next` produit la version Next.js à raccorder ultérieurement à Vercel. Ne pas déployer cette version locale comme un SaaS authentifié.

## Structure

- `app` : entrée App Router, métadonnées et styles.
- `components/milo.tsx` : navigation, vues et éditeurs.
- `types/domain.ts` : types métiers anglais.
- `lib/domain` : validation, règles de calcul et exemples explicitement fictifs.
- `services/local-repository.ts` : contrat de repository et stockage de développement isolé.
- `tests` : tests métiers et de cohérence.
- `standalone`, `vite.offline.config.ts` : version autonome embarquée.
- `docs` : calculs, compatibilité Orbia et état des vérifications.
- `supabase/migrations` : emplacement réservé, aucune migration appliquée.

## Analyses

La rubrique Analyses classe les recettes aux prix actuels : top/flop par marge directe HT par portion, taux de marque (marge / vente HT), taux de marge (marge / coût direct) et coût matière. Filtres par nom, catégorie et fournisseur de coût, sous-recettes comprises. Les prix manquants et les prix de vente non renseignés sont exclus. Le taux de marge est non défini lorsque le coût est nul.

Le catalogue est consultable par fournisseur. Les montants réellement achetés, volumes, filtres opérationnels de période/établissement, rotation et stocks dormants ne sont pas encore calculables : les modules de réception et inventaire restent à développer. Ces vues affichent une indisponibilité explicite et aucun chiffre fictif.

## Suite du travail

Auth et permissions Orbia, repository Supabase, isolation organisation/établissement et RLS, Storage privé, migrations versionnées et Vercel restent à intégrer. Le code est versionné dans `OaksGlobal/milo`. Les modules stocks, inventaires, commandes, réceptions, fabrications, transferts, consommation et prévisions ne sont pas implémentés dans cette tranche.

Il n'existe aucun utilisateur fictif présenté comme authentifié. Aucun secret ni identifiant réel d'organisation n'est embarqué. `.env.example` documente les variables futures ; elles ne sont pas consommées par cet atelier.
