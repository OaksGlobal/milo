# Vérifications de la tranche locale

## Exécuté avec succès

- TypeScript strict (`tsc --noEmit`).
- ESLint sur le projet, avec sorties générées exclues.
- 30 tests métiers : conversions bidirectionnelles, refus masse/volume, petites quantités, conditionnements, coût indépendant de la recette d'exemple, recalcul après hausse, prix inconnu versus zéro, sélection de référence, perte technique, sous-recette, cycles, rendement, arrondi, plancher du prix conseillé, audit, snapshot, références et archivages, identifiants et import.
- Compilation de l'application avec Vinext/Vite dans l'environnement fourni.
- Compilation du fichier autonome React/CSS/JavaScript ; ressources incorporées.

## Limites observées

- Le service d'aperçu navigateur de la session est indisponible (daemon/mailbox absent). Aucun parcours UI, test tactile, redimensionnement mobile/tablette/desktop ou contrôle de console navigateur n'a pu être exécuté. Les règles responsive existent dans le code, mais ne constituent pas une vérification visuelle.
- La compilation Next.js native a été tentée avec webpack : arrêt sur `uv_resident_set_memory` / `ENOENT` dans l'environnement. Le build Vinext réussi ne valide pas à lui seul un futur build Vercel.
- Le contrôle de révision IndexedDB et les transactions sont implémentés ; leur comportement réel dans plusieurs onglets reste à vérifier dans un navigateur.
- Le WebMCP facultatif `get_recipe_cost` est présent ; validation dans un navigateur compatible non effectuée.
- Aucun test Auth, RLS, isolation organisation/établissement, Storage, intégration Supabase ou déploiement Vercel : ces connexions sont différées, pas simulées.

## Recette manuelle à effectuer

1. Ouvrir Milo.html dans un navigateur compatible IndexedDB, commencer vide, charger les exemples volontairement.
2. Créer/modifier fournisseur, article et référence ; tester une conversion incompatible.
3. Modifier le prix de farine et vérifier la hausse du cookie ; figer un coût puis changer le prix et vérifier que l'historique reste stable.
4. Créer une sous-recette ; vérifier le refus de cycle et l'avertissement sur prix inconnu.
5. Exporter, restaurer et recharger la page ; vérifier la conservation des fiches.
6. Ouvrir deux fenêtres : modifier dans chacune et confirmer que la seconde sauvegarde refuse une révision obsolète.
7. Vérifier menu replié, fermeture des dialogues au clavier, champs numériques et formulaires sur mobile, tablette et desktop.

La V0.2 est un atelier de développement local, pas un SaaS opérationnel.

## Extension Analyses

8 tests ajoutés : dénominateurs HT et pourcentages, exclusion des fiches incomplètes, classement top/flop et pertes, ordre du taux matière, coût nul, fournisseur sélectionné, sous-recettes, catalogue sans faux achats. Typecheck, lint et build local relancés après intégration. Le service de navigateur reste indisponible à cette mise à jour.
