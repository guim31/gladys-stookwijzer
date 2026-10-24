# Stookwijzer

Le **Stookwijzer** du RIVM (l'institut national néerlandais de la santé
publique et de l'environnement) indique, pour chaque code postal à 4 chiffres
des Pays-Bas, si allumer un poêle à bois, une cheminée, un chauffage de
terrasse ou un brasero gêne maintenant le voisinage. Cette intégration amène
cet avis dans Gladys pour chacune de vos maisons : un appareil avec l'avis
actuel et celui des prochains créneaux, le vent et l'indice de qualité de
l'air, un widget de tableau de bord et des déclencheurs de scène.

> Le Stookwijzer ne couvre que les **Pays-Bas**. Ailleurs, l'intégration n'a
> rien à montrer et le dit. Elle n'est pas affiliée au RIVM.

## Ce que vous obtenez

- Un appareil **Stookwijzer** par maison de Gladys située aux Pays-Bas.
- L'**avis** en trois codes, tels que le RIVM les donne :
  - **Jaune** : « Attention : faire du feu de bois gêne et pollue l'air »
    (vent de force 3 ou plus et LKI de 3 ou moins) ;
  - **Orange** : « Mieux vaut ne pas faire de feu de bois maintenant » (vent
    de force 3 ou plus et LKI de 4, 5 ou 6) ;
  - **Rouge** : « Ne faites pas de feu de bois » (vent de force 2 ou moins, ou
    LKI de 7 ou plus).
- L'avis des **trois prochains créneaux de 6 heures** (04:00-10:00,
  10:00-16:00, 16:00-22:00 et 22:00-04:00, heure néerlandaise).
- La **vitesse du vent** (m/s), la **force du vent** (Beaufort) et l'**indice
  de qualité de l'air** (LKI, de 1 à 11) sur lesquels l'avis repose.
- Un **widget** de tableau de bord et trois **déclencheurs de scène**.

Il n'y a pas de code vert : ne pas faire de feu de bois reste toujours le
meilleur avis pour un environnement sain, le RIVM l'a donc volontairement
écarté.

## Prérequis

- Gladys Assistant 5.1 ou plus récent.
- Une maison avec une **position** dans Gladys (Paramètres, Maisons, la carte
  de la maison), aux Pays-Bas. L'intégration demande l'accès à la position de
  vos maisons à l'installation : elle ne sert qu'à trouver le code postal, et
  seul le point converti part vers le RIVM.
- Un accès Internet de Gladys vers `data.rivm.nl`. Ni compte, ni clé.

## Configuration

1. Installez l'intégration et acceptez l'accès à la position de vos maisons.
2. Dans **Configuration**, choisissez la **langue** des noms de
   fonctionnalités, du texte de l'avis et des variables de scène (français
   par défaut). Les noms sont fixés à la création de l'appareil : choisissez
   la langue d'abord.
3. Ouvrez l'onglet **Découverte** : un appareil « Stookwijzer _maison_ »
   apparaît pour chaque maison située aux Pays-Bas. Ajoutez-le à Gladys.

Une position ajoutée ou modifiée ensuite dans Gladys est relue à la lecture
horaire suivante, ou tout de suite avec le bouton **Scanner** de l'onglet
Découverte.

## Appareils

Chaque appareil « Stookwijzer _maison_ » a huit fonctionnalités, toutes en
lecture seule :

| Fonctionnalité                   | Type             | Valeurs                    |
| -------------------------------- | ---------------- | -------------------------- |
| Avis actuel                      | Niveau de risque | 1 jaune, 2 orange, 3 rouge |
| Avis                             | Texte            | « Orange — Mieux vaut... » |
| Avis du prochain créneau         | Niveau de risque | 1 jaune, 2 orange, 3 rouge |
| Avis dans 2 créneaux             | Niveau de risque | 1 jaune, 2 orange, 3 rouge |
| Avis dans 3 créneaux             | Niveau de risque | 1 jaune, 2 orange, 3 rouge |
| Vitesse du vent                  | Vitesse (m/s)    | 0 à 60                     |
| Force du vent (Beaufort)         | Vitesse          | 0 à 12                     |
| Indice de qualité de l'air (LKI) | Qualité de l'air | 1 à 11                     |

Gladys affiche les niveaux de risque « Faible », « Moyen » et « Élevé » : ils
valent jaune, orange et rouge. « Pas de risque » (0) n'est jamais utilisé.
L'avis du créneau en cours et celui du suivant sont **définitifs** ; les deux
d'après sont provisoires et peuvent encore changer jusqu'à 6 heures avant
leur début.

Les valeurs sont lues **une fois par heure**. Seules les valeurs qui changent
partent vers Gladys, et toutes les 12 heures, pour que le tableau de
bord n'affiche jamais « pas de valeur récente ».

## Widget de tableau de bord

Ajoutez le widget **Stookwijzer** à un tableau de bord. Il montre l'avis du
créneau en cours en toutes lettres, la force du vent et le LKI en tuiles en
direct, la liste du créneau en cours et des trois suivants avec leur couleur
(les provisoires sont signalés), le code postal, et un bouton vers la page
officielle du Stookwijzer. Dans ses réglages, choisissez la maison ; laissé
vide, le premier appareil Stookwijzer est affiché.

## Déclencheurs de scène

Dans l'éditeur de scènes, sous l'intégration :

- **Stookwijzer : code rouge (pas de feu de bois)** : l'avis actuel de la
  maison passe au rouge.
- **Stookwijzer : fin du code rouge** : l'avis actuel redevient jaune ou
  orange. Le filtre « Nouvel avis » permet de n'en garder qu'un.
- **Stookwijzer : code rouge annoncé au prochain créneau** : le prochain
  créneau est rouge à coup sûr (avis définitif), alors qu'il ne l'est pas
  maintenant. Une fois par créneau, environ 6 heures à l'avance.

Chaque déclencheur peut se limiter à une maison. Les actions suivantes
peuvent utiliser `{{triggerEvent.data.advice_text}}`, `starts_at` et `ends_at`
(les heures du créneau, dans le fuseau de Gladys), `postcode`, `wind_force`
et `lki`.

Un déclencheur ne part jamais à la toute première lecture d'une maison, ni de
nouveau après un redémarrage de l'intégration pour le même avis. L'appareil
doit être ajouté à Gladys pour que ses déclencheurs partent.

## Exemples de scènes

- **Prévenir avant d'allumer le poêle** : déclencheur « code rouge annoncé au
  prochain créneau », action « Envoyer un message » : « Code rouge à partir de
  {{triggerEvent.data.starts_at}} : pas de feu de bois. »
- **Rappel du soir** : à 18:00, si « Avis actuel » de la maison vaut 3
  (Élevé), envoyer « Stookwijzer : n'allumez pas le poêle ce soir. »
- **Retour à la normale** : déclencheur « fin du code rouge », filtre
  « Jaune », éteindre le ruban lumineux rouge qui signalait l'alerte.

## Sources des données et quotas

L'avis vient du service géographique ouvert du RIVM (`data.rivm.nl/geo/alo`,
couche `stookwijzer_v2`), les mêmes données que la page Stookwijzer de l'Atlas
Leefomgeving. L'intégration interroge une fois par heure et par maison, ce
qui suffit : l'avis change par créneau de 6 heures. Le vent et le LKI sont
des calculs de modèle (KNMI, RIVM) moyennés par créneau : ils peuvent
différer des mesures et du vent chez vous.

## Dépannage

- **Aucun appareil dans Découverte** : donnez une position à votre maison
  dans Gladys, aux Pays-Bas, puis appuyez sur **Scanner**. Le statut de
  l'écran Configuration dit pourquoi : aucune maison située, ou des maisons
  hors des Pays-Bas.
- **« Le service géographique du RIVM ne répond pas »** : le dernier avis
  reste affiché ; l'intégration réessaie toutes les 10 minutes.
- **Les noms des fonctionnalités sont dans la mauvaise langue** : ils sont
  fixés à la création. Changez la langue, supprimez l'appareil et ajoutez-le
  de nouveau (son historique est perdu).
- Pour le détail, réglez `LOG_LEVEL=debug` et lisez les logs de
  l'intégration.

## Limites

- Pays-Bas seulement ; l'avis est celui du code postal à 4 chiffres de la
  maison.
- Développée et testée avec les vraies données du RIVM, mais sans avis orange
  ni rouge le jour du développement : ces cas sont testés sur des
  enregistrements modifiés. Vos retours sont les bienvenus.
- Le Stookwijzer est un avis. Certaines communes interdisent les feux de bois
  en code orange ou rouge : vérifiez les règles locales.
- Non affiliée au RIVM.
