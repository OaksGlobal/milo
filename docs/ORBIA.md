# Raccordement Orbia — préparation au 21 septembre 2026

Les sources Milo sont disponibles dans `OaksGlobal/milo`. Le propriétaire a confirmé que les établissements existants sont des tests. Le socle commun est préparé dans [Helly #46](https://github.com/OaksGlobal/helly/pull/46), mais n'est pas appliqué au projet Supabase hébergé. L'interface Milo reste un atelier local.

## Code préparé dans ce lot

`services/orbia-context.ts` valide la session par Supabase Auth, puis lit `orbia_product_context('milo')` pour l'organisation et l'établissement choisis. Il exige une URL HTTPS, une clé publiable moderne et le jeton utilisateur. Aucun accès administrateur ni lecture directe de table RH. Les droits sont relus à chaque appel ; une absence de contexte ou un rôle employee provoque un refus. L'accès commercial est séparé du rôle utilisateur.

`services/orbia-import.ts` exporte `prepareOrbiaImport(sourceJson, config, organizationId, locationId)`. Cette fonction produit uniquement un aperçu d'import : elle valide la sauvegarde, vérifie un accès Milo actif avec rôle owner/admin/manager et retourne la destination, les comptages et une empreinte SHA-256. Elle conserve UUID, éléments archivés et coûts historiques sans modifier l'atelier IndexedDB ni écrire à distance. Taille maximale : 20 Mio.

Les anciens événements locaux sont marqués `local-unverified` ; ils ne deviennent pas un journal serveur authentifié. L'aperçu et son empreinte ne constituent pas une autorisation d'import : le futur serveur devra revérifier droits, destinations, références, doublons et conflits dans une transaction. Il devra créer son propre événement d'audit avec l'identité authentifiée.

Ces services ne sont pas encore branchés à l'interface. Aucun repository Supabase, table métier, parcours de connexion ou import distant n'est livré ici. Les variables d'environnement restent réservées à ce futur raccordement.

## Vérifications du lot

- `pnpm test` : 36 tests réussis, dont validation du contexte, révocation, rôle lecteur, expiration, conservation des historiques et absence de mutation pendant l'aperçu.
- `pnpm run typecheck` et `pnpm run build:next` : réussis.
- Le scénario SQL du socle Helly (`scripts/test-orbia-products.mjs`) vérifie les droits Milo indépendants de Cento et la portée des établissements avec des données synthétiques.
- Les réponses HTTP des tests sont simulées. Le parcours Supabase Auth/PostgREST avec une session réelle et l'import distant restent à tester après implémentation et déploiement en préproduction.

## Existant inspecté dans cette conversation

Le projet Supabase Helly contient `shops`, `shop_members`, `profiles`, `employees`, `access_roles` et des tables de planning reliées à des `location_id`. Les tables canoniques `organizations`, `locations`, `organization_memberships` étaient absentes au moment de l'inspection. Le README Nomi signale une base encore non connectée et des migrations pour base neuve qui ne doivent pas être exécutées sur Helly. Le code Pulp consulté conserve les fiches de coût dans le navigateur.

Aucune production, table existante, permission, donnée d'entreprise ou configuration Auth n'a été modifiée pour cette livraison.

## Décisions

1. Les UUID d'établissements Helly sont à préserver. Ne pas recopier les établissements, comptes ou salariés dans Milo.
2. Ne pas déduire les organisations des noms, des adresses ou du propriétaire commun. Pour les établissements de test confirmés, utiliser des correspondances fictives explicites et préserver les données existantes.
3. Utiliser le socle commun compatible avec Helly : il prévoit le renommage physique `shops` → `locations` avec une vue `shops` de compatibilité et conservation des UUID/FK. Ne pas créer une fondation concurrente propre à Milo.
4. Inspecter de nouveau schéma, contraintes, fonctions RLS et migrations au moment du raccordement. Les observations de cette conversation ne suffisent pas à appliquer un schéma hypothétique.
5. Inspecter les tables fournisseurs et références de Nomi avant de créer leur équivalent : partager le fournisseur et les identifiants utiles au lieu de deux sources concurrentes.
6. Pulp devra lire un coût Milo avec son identifiant de produit/recette, sa date, sa méthode et son unité, et garder ses commissions/promotions comme calcul propre. Ne pas écraser automatiquement ses fiches locales.

## Modèle métier à raccorder

Les collections locales ne sont pas des tables Supabase et ne portent volontairement aucun faux `organization_id` ou `location_id`.

| Collection locale | Rattachement futur |
| --- | --- |
| suppliers | Fournisseur commun à réutiliser, périmètre organization_id |
| items | Article commun, catégorie et unité ; organization_id |
| references | Article + fournisseur existants ; organization_id |
| recipes + lines | Recette organisationnelle ; composants par identifiants |
| snapshots | Historique de coûts datés, prix sources et auteur authentifié |
| audit | Audit serveur, auteur auth.users, organisation et établissement si applicable |

Les stocks seront distincts, indexés par `organization_id`, `location_id`, `item_id`. Toute relation inter-table devra empêcher les références croisées entre organisations, y compris par clés étrangères composites. Les données financières seront protégées par permissions réelles dans les RPC, vues et RLS ; masquer l'interface ne suffit pas.

Le contrat `WorkspaceRepository` sert la version locale. Le futur repository distant ne doit pas envoyer tout l'état JSON à une table unique : il utilisera des entités normalisées, opérations métier atomiques, versions de ligne et permissions. Auth absente = refus d'accès dans la version connectée ; aucun repli silencieux sur les exemples.

## Ordre d'intégration

- Préparer la correspondance de test organisation ↔ établissements et les droits explicites par application.
- Préparer migration SQL versionnée et tests d'isolation sur une base de test compatible.
- Auth Supabase commune et accès produit Milo.
- CRUD métier protégé ; journal serveur et snapshots non modifiables.
- Storage privé et URLs temporaires.
- Tests inter-organisations/inter-établissements, puis raccordement GitHub/Vercel et recette complète.

Aucune migration SQL métier Milo n'est livrée à ce stade. Le socle canonique est proposé dans Helly ; le partage fournisseurs/articles avec Nomi, les contraintes métier et la répétition sur Supabase restent à finaliser.
