# Site Juste Recrute Moi

Racine du projet Vercel : `website/`.

## Compteur de vues

Le compteur de vues uniques est implemente dans `api/views.js`.

Pour conserver le compteur sur Vercel, ajoutez ces variables d'environnement :

```txt
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
VIEW_COUNT_BASELINE=0
DOWNLOAD_COUNT_BASELINE=0
```

Chaque navigateur recoit un identifiant visiteur local. L'API le compte une seule fois avec Redis `SET NX`. Les lectures sont mises en cache cote API/CDN, puis cote navigateur pendant six heures, afin d'eviter de consommer inutilement des commandes Upstash.

Le navigateur conserve aussi le flag `juste-recrute-moi.views.counted`. Un visiteur qui revient dans un nouvel onglet ou une nouvelle session ne declenche donc pas de nouvelle ecriture Redis.

Variables de securite utiles :

```txt
COUNTER_WRITES_ENABLED=false
COUNTER_SERVER_CACHE_SECONDS=1800
COUNTER_CDN_CACHE_SECONDS=21600
COUNTER_VISITOR_TTL_DAYS=400
COUNTER_HASH_SALT=...
```

Passez `COUNTER_WRITES_ENABLED=false` en urgence si le nombre de commandes Upstash augmente trop vite. La page continue alors d'afficher la baseline configuree ou les valeurs en cache.

Les identifiants visiteurs sont hashes avant d'etre utilises dans les cles Redis. Definissez `COUNTER_HASH_SALT` avec un secret stable pour conserver la deduplication entre deploiements sans stocker les identifiants bruts cote serveur.

## Compteur de telechargements

Le compteur de telechargements est implemente dans `api/downloads.js`. Il utilise le meme identifiant visiteur et le meme modele Redis `SET NX`, afin qu'un navigateur ne soit compte qu'une fois par plateforme lorsqu'un vrai artefact d'installation est clique.

Il suit le total global et les compteurs Windows, macOS et Linux. Pour un lancement public neuf, laissez `DOWNLOAD_COUNT_BASELINE=0`.

En cas de migration vers une nouvelle base Upstash, renseignez `VIEW_COUNT_BASELINE` et `DOWNLOAD_COUNT_BASELINE`, ou semez Redis directement :

```txt
SET juste-recrute-moi:views:total <total-vues>
SET juste-recrute-moi:downloads:total <total-telechargements>
SET juste-recrute-moi:downloads:windows <total-windows>
SET juste-recrute-moi:downloads:mac <total-mac>
SET juste-recrute-moi:downloads:linux <total-linux>
```

## Boutons de telechargement

Les boutons de telechargement utilisent `api/releases.js`, qui lit la derniere release GitHub de `ValMtp3/Juste-Recrute-Moi` et associe les artefacts aux plateformes :

- Windows : `.exe`, `.msi`, `.msix`, ou nom contenant `windows`, `win32`, `win64` ;
- macOS : `.dmg`, `.pkg`, ou nom contenant `mac`, `darwin`, `apple` ;
- Linux : `.AppImage`, `.deb`, `.rpm`, ou nom contenant `linux`.

Si aucun artefact n'est disponible pour une plateforme, le bouton reste desactive et indique `Bientot disponible`.

## Retours et avis

Les formulaires de retour et d'avis envoient leurs donnees a `api/feedback.js`.

Pour creer des issues GitHub depuis les soumissions, ajoutez :

```txt
GITHUB_FEEDBACK_TOKEN=...
GITHUB_FEEDBACK_REPO=ValMtp3/Juste-Recrute-Moi
```

Le token doit pouvoir creer des issues dans le depot cible. `GITHUB_FEEDBACK_REPO` est optionnel et vaut `ValMtp3/Juste-Recrute-Moi` par defaut.

Labels recommandes :

```txt
website-feedback
feedback
review
```

Pages filtrees utiles :

- retours : `https://github.com/ValMtp3/Juste-Recrute-Moi/issues?q=is%3Aissue%20label%3Awebsite-feedback`
- avis : `https://github.com/ValMtp3/Juste-Recrute-Moi/issues?q=is%3Aissue%20label%3Areview`

Les retours et avis passent uniquement par des issues GitHub. Si la livraison GitHub n'est pas configuree, l'endpoint renvoie `202` et la page indique que la configuration de livraison reste a terminer.

Comme les issues GitHub sont publiques, l'API retire les champs nom/email separes et masque les emails, numeros de telephone, bearer tokens et formats courants de cles API dans le message. Demandez aux utilisateurs de ne jamais coller de CV prive, identifiant de compte ou secret dans le formulaire public.
