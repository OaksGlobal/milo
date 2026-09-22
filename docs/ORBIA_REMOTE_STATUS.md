# Milo — comparaison et préparation distante, 22 septembre 2026

## Verdict

Préparation poursuivie sur `codex/milo-remote-persistence-20260922`, dérivée de la tête de Milo #1, sans remplacement du travail antérieur. **La persistance distante n’est pas opérationnelle.** Ce lot livre un adaptateur client par opération et une préparation d’import normalisée, plus les contrats nécessaires au backend et au catalogue commun. Il ne livre pas les RPC serveur, les migrations métier ni le raccordement de l’interface.

## Références GitHub vérifiées avant modification

| PR | État observé | Commit de tête |
| --- | --- | --- |
| [Helly #46](https://github.com/OaksGlobal/helly/pull/46) | ouverte, non fusionnée | `d9a5776a07e63145092f00d1196c5ebe6561ff0e` |
| [Pulp #2](https://github.com/OaksGlobal/pulp/pull/2) | ouverte, non fusionnée | `8773d9532c678ab5970eb4f8facae81ac881d16d` |
| [Cento #1](https://github.com/OaksGlobal/cento/pull/1) | ouverte, non fusionnée | `10f930c27cf271ca335775c7fb35c55cf807d5fd` |
| [Milo #1](https://github.com/OaksGlobal/milo/pull/1) | ouverte, non fusionnée | `6fad2fdab8f5a3c244fb008a157aa896104f9d61` |
| [Nomi #1](https://github.com/OaksGlobal/Nomi/pull/1) | ouverte, non fusionnée | `8ab330262e8500eee72efea45a1b029561c8a6ab` |

Milo main observé : `6ef2d14523a287a4946c21954a603514555a15e0`. Le rapport central lu est `helly/docs/ORBIA_HOSTED_STATUS.md` au commit Helly ci-dessus. Les résultats Auth du 22 septembre sont rapportés par cette source et l’utilisateur ; ils n’ont pas été rejoués dans ce lot.

## Vérifié dans le code

- `components/milo.tsx` appelle exclusivement `services/local-repository.ts` : IndexedDB reste la source de données de l’interface.
- `services/orbia-context.ts` valide Auth puis le contexte Milo exact ; `services/orbia-import.ts` est seulement un aperçu sans écriture.
- Aucun Auth UI, Stripe, stock transactionnel ou import serveur n’est ajouté par ce lot.
- Nomi `scripts/schema.sql` possède des fournisseurs organisationnels et des références fournisseur par établissement, distinctes des ingrédients Milo. Son bootstrap autonome est incompatible avec une application directe à Helly et ne doit pas être exécuté.
- L’ancienne remarque de `docs/ORBIA.md` sur l’absence du socle décrivait l’inspection initiale. Elle a été clarifiée, pas reprise comme état actuel.

## Vérifié sur les services connectés (lecture seule)

Projet Supabase : `stfekzodfzovprsfblkl`. Catalogues PostgreSQL inspectés, aucune donnée personnelle lue.

- `public.shops` est une table avec RLS, PK id et contrainte unique `(id, organization_id)` ; FK organization_id vers organizations.
- `public.locations` est une vue avec `security_invoker=true`.
- organizations, organization_memberships, organization_product_access et subscriptions existent avec RLS.
- `public.orbia_product_context(text)` expose organisation, établissement, timezone, rôle, product_active, expires_at et can_manage_billing. Son helper privé calcule les droits à partir de auth.uid(), des appartenances et accès courants ; le paramètre produit évite une dépendance à l’abonnement Helly.
- Aucune table `suppliers`, `supplier_products`, `items` ou préfixée `milo` n’apparaît dans le catalogue public inspecté. Cela ne prouve pas l’absence d’un modèle dans une autre base Nomi.
- La liste Vercel de l’équipe accessible contient cinq projets, aucun nommé Milo. Aucun déploiement Milo vérifiable dans ce périmètre. Aucun réglage Vercel modifié.

## Code ajouté, non activé

| Élément | Ce qui est préparé | Limite |
| --- | --- | --- |
| `services/orbia-remote-repository.ts` | Lecture projetée, mutation par entité, contexte relu, version attendue, clé idempotente fournie, contrôles de réponse, erreurs de conflit/issue incertaine | RPC proposées absentes ; aucune garantie serveur validée par les mocks |
| `services/orbia-import-bundle.ts` | Lots normalisés, UUID et lignes ordonnées conservés, historiques marqués non authentifiés, empreinte source, refus de pertes silencieuses de champs | Aperçu uniquement ; pas d’import, pas de fusion Nomi implicite |
| `docs/contracts/MILO_REMOTE_V1.md` | Contrat serveur, transaction, RLS, reprise, sauvegardes, retour arrière et tests à réaliser | Décisions et implémentation backend encore nécessaires |
| `docs/contracts/NOMI_CATALOG_PROPOSAL.md` | Comparaison concrète des modèles et ownership proposé | Proposition non encore convenue entre applications |

L’adaptateur reste volontairement hors interface : un appel distant non installé provoque un refus explicite, jamais un succès simulé ou un repli vers les exemples. L’export HTML existant reste l’atelier local ; il n’a pas été remplacé.

## Tests de ce lot

- `pnpm test` : **47 réussis** (36 existants, 11 nouveaux).
- `pnpm run typecheck` : réussi.
- `pnpm run lint` : réussi sans avertissement après correction.
- `pnpm run build:next` : réussi, compilation et génération des pages ; build local, pas Vercel.
- Les 11 nouveaux tests sont des tests unitaires/contrat à réponses HTTP simulées : périmètre, expiration, révocation, rôles financiers, absence de backend, conflits, réponse incertaine, reprise idempotente côté client et conservation des données importées. Ils ne testent pas RLS ou une écriture Supabase réelle.
- Pas de nouvelle migration, de compte fictif, d’écriture en base, de test navigateur ou de déploiement.

## Ordre des prochaines décisions et réalisations

1. Revue commune du catalogue fournisseurs/articles avec Nomi : identité, visibilité établissement, droits d’écriture et provenance des observations ; pas de double référentiel créé dans l’attente.
2. Valider les droits financiers et lecture après expiration de Milo. L’adaptateur complet refuse par prudence employee/viewer/accountant ; un manager reste soumis au périmètre de chaque opération côté serveur.
3. Préparer les migrations additives et les RPC à partir du contrat, avec tests PostgreSQL et Auth/HTTP sur environnement compatible. Préserver shops et les UUID ; pas de db push global.
4. Après coordination, sauvegarde/restauration et validation, appliquer uniquement les nouvelles migrations ciblées ; consigner versions hébergées et empreintes.
5. Raccorder Auth, choix organisation/établissement, UI et récupération des opérations en attente, puis importer un périmètre pilote avec mappings explicites.
6. Valider parcours métier et isolation réels avant fusion/activation et publication Vercel. La facturation et les fonctions stock ne sont pas rendues opérationnelles par ce lot.
