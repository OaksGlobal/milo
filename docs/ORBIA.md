# Raccordement Orbia — contrat à finaliser avant migration

## Existant inspecté dans cette conversation

Le projet Supabase Helly contient `shops`, `shop_members`, `profiles`, `employees`, `access_roles` et des tables de planning reliées à des `location_id`. Les tables canoniques `organizations`, `locations`, `organization_memberships` étaient absentes au moment de l'inspection. Le README Nomi signale une base encore non connectée et des migrations pour base neuve qui ne doivent pas être exécutées sur Helly. Le code Pulp consulté conserve les fiches de coût dans le navigateur.

Aucune production, table existante, permission, donnée d'entreprise ou configuration Auth n'a été modifiée pour cette livraison.

## Décisions

1. Les UUID d'établissements Helly sont à préserver. Ne pas recopier les établissements, comptes ou salariés dans Milo.
2. Ne pas déduire les organisations des noms, des adresses ou du propriétaire commun. Le regroupement doit être confirmé au niveau métier avant tout changement de périmètre d'accès.
3. Préparer une transition additive compatible avec Helly ; pas de renommage destructif automatique.
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

- Confirmer organisation ↔ établissements et politique des droits conservés.
- Préparer migration SQL versionnée et tests d'isolation sur une base de test compatible.
- Auth Supabase commune et accès produit Milo.
- CRUD métier protégé ; journal serveur et snapshots non modifiables.
- Storage privé et URLs temporaires.
- Tests inter-organisations/inter-établissements, puis raccordement GitHub/Vercel et recette complète.

Aucune migration SQL n'est livrée comme applicable à la production à ce stade : le schéma canonique n'est pas encore confirmé.
