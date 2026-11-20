# aWATTar

Les prix horaires du tarif d'électricité dynamique
[aWATTar HOURLY](https://www.awattar.at/tariffs/hourly), en Allemagne et en Autriche,
dans Gladys : le prix de l'heure en cours, les heures les moins chères du jour, un
graphique des prix d'aujourd'hui et de demain, et des déclencheurs de scène pour faire
tourner vos appareils quand l'électricité est la moins chère.

Cette intégration n'a aucun lien avec aWATTar ni tado°. Elle lit les données de marché
publiques d'aWATTar, testée contre l'API réelle, mais elle a été développée sans contrat
aWATTar : vos retours sont les bienvenus.

## Présentation

aWATTar publie, sans compte ni clé, les **prix horaires day-ahead EPEX Spot** de
l'Allemagne (zone DE-LU) et de l'Autriche (zone AT). L'intégration en tire le **prix
aWATTar HOURLY** de votre pays : pas seulement le prix brut du marché, mais le prix du
marché plus les composantes d'aWATTar (voir _Formule du prix_), avec ou sans TVA. Le
prix brut du marché de l'heure en cours reste disponible dans sa propre fonctionnalité.

Les prix du lendemain sont publiés vers 14 h. Toutes les heures sont affichées à l'heure
d'Europe centrale (Berlin et Vienne), et une journée va de minuit à minuit à cette
heure-là, quel que soit le fuseau de votre Gladys.

aWATTar Allemagne est devenu **tado° Energy** : l'API et le tarif restent les mêmes.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Un accès à Internet depuis Gladys vers `api.awattar.de` ou `api.awattar.at`.
- Rien d'autre : ni compte, ni clé d'API, ni matériel.

## Installation

1. Dans Gladys, ouvrez **Intégrations → Installer depuis GitHub** et saisissez
   `https://github.com/guim31/gladys-awattar`.
2. Ouvrez l'intégration, choisissez votre pays, vérifiez les champs du tarif,
   enregistrez.
3. Ouvrez l'onglet **Découverte** et ajoutez l'appareil **aWATTar Deutschland** ou
   **aWATTar Österreich**.
4. Sur un tableau de bord, ajoutez le widget **Prix de l'électricité**.

## Configuration

| Champ                              | Défaut         | Effet                                                                          |
| ---------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| Pays                               | Allemagne      | Marché et tarif : Allemagne ou Autriche. Un autre pays donne un autre appareil |
| Inclure la TVA                     | Oui            | Prix avec le taux de TVA ci-dessous                                            |
| Supplément (ct/kWh, HT)            | Valeur du pays | Ajouté à chaque heure avant TVA. Vide : 1,5 en Autriche, 0 en Allemagne        |
| Marge (% du prix du marché)        | 0              | Un pourcentage du prix du marché, toujours ajouté comme un coût. Vide : 0      |
| Taux de TVA (%)                    | Valeur du pays | Vide : 19 en Allemagne, 20 en Autriche                                         |
| Langue des noms de fonctionnalités | Français       | Utilisée quand l'appareil est ajouté : les noms ne changent plus ensuite       |

Les décimales acceptent le point ou la virgule (`1,5`). Une valeur illisible revient à
la valeur du pays. Pour voir votre **prix complet par kWh**, ajoutez au supplément vos
frais de réseau, contributions et taxes par kWh (HT).

Le bouton **Relever les prix maintenant** interroge aWATTar tout de suite et affiche ce
qu'il publie pour aujourd'hui et demain : utilisez-le pour vérifier la connexion.

## Formule du prix

Pour chaque heure :

`prix = (marché + |marché| × marge % + supplément) × (1 + TVA %)`

- **Autriche** : aWATTar publie EPEX Spot AT + 1,5 ct/kWh, plus 20 % de TVA sur le
  tout. Exemples d'aWATTar : 5,00 ct donne 7,80 ct, 0,00 ct donne 1,80 ct, −5,00 ct
  donne −4,20 ct. Ce sont les valeurs par défaut.
- **Allemagne** : tado° Energy publie le prix EPEX Spot DE-LU « plus d'autres coûts
  d'approvisionnement, taxes, contributions et frais de réseau », régionaux et non
  donnés en un seul chiffre. Le supplément par défaut est 0 : saisissez les coûts par
  kWh de votre contrat.
- Non compris par défaut : frais de réseau, contributions, abonnement mensuel
  (Autriche 5,75 €, Allemagne 4,58 € plus le comptage).

## L'appareil aWATTar

Un appareil par pays, en lecture seule, actualisé par l'intégration elle-même chaque
minute (les prix sont lus chez aWATTar une fois par heure).

| Fonctionnalité                    | Type     | Valeur                                                                              |
| --------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| Prix actuel (€/kWh)               | Prix     | Prix aWATTar HOURLY de l'heure en cours                                             |
| Prix heure suivante (€/kWh)       | Prix     | Prix de l'heure suivante (après 23 h, une fois demain connu)                        |
| Prix moyen du jour (€/kWh)        | Prix     | Moyenne des heures du jour                                                          |
| Prix min du jour (€/kWh)          | Prix     | Heure la moins chère du jour                                                        |
| Prix max du jour (€/kWh)          | Prix     | Heure la plus chère du jour                                                         |
| Heure la moins chère du jour      | Texte    | Début de l'heure la moins chère, `HH:MM`                                            |
| Heure la plus chère du jour       | Texte    | Début de l'heure la plus chère, `HH:MM`                                             |
| Rang de l'heure (1 = moins chère) | Compteur | Rang de l'heure en cours dans la journée, 1 à 24 (23 ou 25 aux changements d'heure) |
| Prix du marché actuel (€/kWh HT)  | Prix     | Prix EPEX Spot de l'heure en cours, sans rien d'ajouté                              |

Gladys n'a pas d'unité €/kWh : les prix s'affichent en euros, le nom dit par quoi.
Quand une fonctionnalité est la seule de son type sur l'appareil, le tableau de bord
affiche le libellé générique du type (« Compteur (entier) ») à la place de son nom.

## Widget du tableau de bord

**Prix de l'électricité** affiche le prix montré (avec ou sans TVA), trois tuiles
(maintenant, heure suivante, moyenne du jour), le graphique d'aujourd'hui et de demain
avec l'heure la moins chère et la plus chère de chaque jour et un trait à l'heure
actuelle, puis l'heure la moins chère d'aujourd'hui et de demain, la moyenne de demain
et le prix du marché de l'heure en cours. Tant que les prix de demain ne sont pas
publiés, il l'indique.

## Déclencheurs de scène

Trois déclencheurs, dans l'éditeur de scènes sous **aWATTar**. Ils comparent les prix
de la configuration (prix aWATTar HOURLY, avec ou sans TVA).

### Les heures les moins chères du jour commencent

Se déclenche une fois par jour, au début de la plage d'heures consécutives la moins
chère du jour. Choisissez la durée de la plage : 1 à 6 ou 8 heures (1 heure, c'est
l'heure la moins chère du jour). Variables : prix moyen de la plage, heure de début et
de fin.

### Une des heures les moins chères commence

Se déclenche au début de chacune des N heures les moins chères du jour, consécutives ou
non. Choisissez N : 1 à 6, 8, 10 ou 12. Variables : prix de l'heure, son rang, heure de
début et de fin.

### Le prix passe sous un seuil

Se déclenche au début d'une heure dont le prix est sous le seuil quand l'heure
précédente ne l'était pas : une fois par période bon marché. Choisissez le seuil :
0 ct/kWh (prix négatifs) à 40 ct/kWh par pas de 5. Variables : prix de l'heure, heure
de début, et fin de la période bon marché d'après les prix connus. Contrairement à une
condition sur la fonctionnalité **Prix actuel**, il dit combien de temps dure la
période, et il fonctionne sans l'appareil.

Tous les déclencheurs partent quand l'heure commence, au plus 10 minutes en retard
(redémarrage de Gladys ou de l'intégration) : une heure commencée plus tôt ne déclenche
rien.

## Exemples de scènes

- **Lave-vaisselle dans les 3 heures les moins chères** : déclencheur _Les heures les
  moins chères du jour commencent_, 3 heures → allumer la prise du lave-vaisselle.
- **Ballon d'eau chaude sur les 4 heures les moins chères** : déclencheur _Une des
  heures les moins chères commence_, 4 → allumer le ballon ; une seconde scène sur
  _Rang de l'heure_ supérieur à 4 → l'éteindre.
- **Prix négatif** : déclencheur _Le prix passe sous un seuil_, 0 ct/kWh → allumer le
  ballon et envoyer « L'électricité est gratuite jusqu'à {end_time} ».

## Actualisation et usage de l'API

aWATTar demande un usage raisonnable de son API gratuite : 100 requêtes par jour au
plus. L'intégration reste bien en dessous :

- une requête par heure, pour aujourd'hui et demain ensemble ;
- à partir de 13 h, de nouveau toutes les 15 minutes jusqu'à la publication des prix de
  demain, puis toutes les heures (environ 60 requêtes par jour au pire) ;
- après un échec, nouvel essai après 5, 10, 20, 40 puis 60 minutes ; les derniers prix
  connus restent utilisés entre-temps (les prix sont connus un jour à l'avance).

Les états ne sont publiés que lorsqu'ils changent, plus un rappel toutes les 6 heures.

## Dépannage

- **« aWATTar est injoignable »** dans l'écran Configuration : Gladys n'a pas accès à
  Internet, ou aWATTar est en panne. Les derniers prix connus restent utilisés ;
  appuyez sur **Relever les prix maintenant** pour réessayer.
- **« ne publie encore aucun prix pour aujourd'hui »** : aWATTar a répondu sans prix
  pour la journée, un incident de publication. L'intégration réessaie toutes les 15
  minutes.
- **Aucune valeur sur l'appareil** : ajoutez d'abord l'appareil depuis l'onglet
  Découverte ; ses valeurs arrivent aussitôt.
- **Pays changé** : ajoutez le nouvel appareil depuis l'onglet Découverte ; l'ancien ne
  reçoit plus de valeurs et peut être supprimé.
- **Logs de débogage** : réglez `LOG_LEVEL=debug` sur le conteneur pour voir chaque
  actualisation.

## Limites

- Développée sans contrat aWATTar : la formule suit ce qu'aWATTar publie, pas une
  facture. Comparez-la avec votre facture et ajustez les champs.
- Prix horaires, comme les facture le tarif HOURLY. Si aWATTar publiait des
  quarts d'heure, ils seraient ramenés à la moyenne de l'heure.
- Pas de connexion au compte : ni consommation, ni coûts, ni prix personnalisés.
- Les déclencheurs ne regardent que la journée en cours : une plage la moins chère ne
  passe jamais minuit.
- Lecture seule : l'intégration ne commande rien elle-même.
- Les noms des fonctionnalités sont fixés à l'ajout de l'appareil ; changer la langue
  ensuite ne les renomme pas.
