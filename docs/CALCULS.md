# Conventions de calcul

Tous les coûts d'achat sont HT. Les prix de vente sont TTC, convertis avec la TVA propre à chaque recette. Les quantités sont positives ; le rendement et l'arrondi sont strictement positifs.

## Unités et achats

- 1 kg = 1 000 g ; 1 l = 1 000 ml.
- Pièce représente le comptage. Aucune conversion kg/l n'est permise.
- Quantité physique par achat = nombre de contenants × contenu par contenant.
- Coût unitaire = prix HT de l'achat / quantité physique convertie dans l'unité de référence.
- Exemple : carton de 6 bouteilles de 1 l, prix 12 € HT : 2 €/l.
- Une référence active unique est choisie automatiquement. Plusieurs références exigent un choix explicite au niveau article. Un prix absent est inconnu, jamais supposé gratuit. Un prix nul saisi explicitement est accepté.

## Recettes

La quantité saisie est la quantité nette nécessaire. Quantité brute = quantité nette / (1 − perte technique / 100). Une perte de 20 % exige donc 1,25 kg bruts pour 1 kg net. Le rendement est exprimé en portions ; les sous-recettes sont consommées en portions. Les cycles directs ou indirects sont refusés.

Les emballages sont séparés des matières. La main-d'œuvre vaut minutes / 60 × coût horaire chargé. Les coûts des sous-recettes sont répartis proportionnellement entre matière, emballage et travail. Coût direct = ces trois composantes ; il ne comprend pas les frais fixes ou commissions.

Le prix minimal HT conseillé est le maximum du coût direct par portion et de (coût matière par portion / taux matière cible). On applique la TVA, puis arrondit le TTC vers le haut au pas commercial. Le HT affiché correspond au TTC effectivement arrondi. La marge affichée est la marge sur coût direct au prix actuel, pas un résultat net. Le conseil reste modifiable dans le champ prix actuel.

Les calculs utilisent les nombres JavaScript, arrondis à six décimales pour les résultats métiers, et à deux décimales pour le conseil TTC. Ceci est un chiffrage de gestion local, pas un moteur de facturation. Le raccordement transactionnel au stock utilisera PostgreSQL NUMERIC avec politique d'arrondi documentée.

Le recalcul est immédiat à la lecture. « Figer ce coût » enregistre une copie du coût et de la composition ; une hausse future ne modifie pas cette copie. Les snapshots ne représentent ni une réception ni un mouvement de stock.
