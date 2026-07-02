# Contribuer À Juste Recrute Moi

Merci de contribuer à Juste Recrute Moi.

Le projet vise un agrégateur local-first d'offres d'emploi, centré sur le marché français. L'objectif n'est pas de construire une machine d'auto-candidature massive, mais d'aider les utilisateurs à trouver de meilleures offres, comprendre leur pertinence et préparer des candidatures plus solides tout en gardant leurs données locales.

## Périmètre Du Projet

Le cœur open source couvre :

- collecte d'offres depuis des sources fiables ;
- normalisation des offres ;
- filtre qualité et déduplication ;
- ranking profil/offre ;
- matching avec graphe et vecteurs locaux ;
- génération de CV, lettres et messages d'approche ;
- expérience desktop local-first.

Le laboratoire expérimental couvre :

- automatisation navigateur ;
- lecture et remplissage de formulaires ;
- auto-candidature.

Ce laboratoire peut être amélioré, mais il ne doit pas devenir la promesse principale du produit.

## Licence

Juste Recrute Moi est distribué sous [AGPL-3.0-only](LICENSE). Toute contribution doit rester compatible avec cette licence. Le dépôt est un fork ; les notices upstream conservées dans le code, `NOTICE` et l'historique ne doivent pas être supprimées sans raison juridique claire.

## Avant De Commencer

Ouvrez une issue avant de travailler si votre changement :

- ajoute une dépendance ;
- modifie le schéma des leads ou une API ;
- change le comportement de ranking ;
- touche au stockage local ;
- modifie le packaging ou la release ;
- touche à l'automatisation expérimentale ;
- refond un flux UI important.

Les corrections de documentation, fixtures, tests et petits connecteurs peuvent généralement partir directement en PR.

## Installation Locale

Prérequis :

- Node.js 24 recommandé ;
- Python 3.13+ ;
- Rust stable ;
- uv ;
- pnpm 10.33.2, via Corepack ou installation locale ;
- Git.

Installation :

```bash
corepack enable
pnpm install
cd backend
uv sync --dev
cd ..
```

Lancer l'app desktop :

```bash
pnpm dev:local
```

Lancer le frontend seul :

```bash
pnpm dev
```

## Tests Et Vérifications

Frontend :

```bash
pnpm typecheck
pnpm test
pnpm build
```

Backend :

```bash
cd backend
UV_CACHE_DIR=../.uv-cache uv run python -m pytest tests -q
```

Rust :

```bash
cd src-tauri
cargo check
```

## Checklist PR

- [ ] La PR est ciblée.
- [ ] Les tests pertinents ont été lancés.
- [ ] Les changements de comportement ont des tests.
- [ ] La documentation est mise à jour si l'utilisateur ou le contributeur est concerné.
- [ ] Aucune clé API, cookie, base locale, CV privé ou PDF généré n'est commité.
- [ ] Les changements d'automatisation restent opt-in et clairement marqués comme expérimentaux.
- [ ] L'impact utilisateur est expliqué.

## Ajouter Une Source

Lisez [docs/source-adapters.md](docs/source-adapters.md) avant d'ajouter un connecteur.

Sources à privilégier :

- API France Travail ;
- API ATS directes ;
- pages carrière publiques structurées ;
- flux RSS/API ;
- threads communautaires fiables.

Sources moins fiables :

- résultats de recherche larges ;
- HTML sans structure stable ;
- sources nécessitant cookies ou contournements ;
- sites qui bloquent fortement l'automatisation.

À éviter :

- sources nécessitant des identifiants privés pour les tests de base ;
- sources manifestement contraires aux conditions d'utilisation ;
- marketplaces spammy ;
- offres impossibles à vérifier.

Un connecteur doit renvoyer au minimum :

- `title` ;
- `company` ;
- `url` ;
- `platform` ;
- `description`.

Champs recommandés :

- `posted_date` ;
- `location` ;
- `tech_stack` ;
- `signal_score` ;
- `signal_reason` ;
- `signal_tags` ;
- `source_meta`.

## Règles De Ranking Et Qualité

Préservez ces principes :

- ne pas surclasser des postes trop seniors pour des profils juniors ;
- ne pas masquer l'incertitude ;
- ne pas inventer de faits candidat ;
- pénaliser les annonces pauvres ou douteuses ;
- privilégier les preuves issues des projets et expériences ;
- rendre les raisons compréhensibles.

## Frontend

L'interface doit rester un outil de travail, pas une landing page marketing.

- Garder le parcours central lisible : offres, ranking, profil, génération.
- Ne pas présenter l'auto-apply comme le produit principal.
- Réutiliser les composants et styles existants.
- Garder des textes courts, utiles et honnêtes.
- Afficher les explications quand un score ou filtre influence l'utilisateur.

## Backend

- Garder les scrapers déterministes quand c'est possible.
- Éviter les appels réseau dans les tests.
- Lazy-loader les dépendances lourdes.
- Dégrader proprement quand une source ou un système optionnel échoue.
- Préserver les données locales existantes.
- Préférer de petits modules testables aux gros fichiers d'agent.

## Sécurité Et Données Privées

Ne commitez jamais :

- clés API ;
- cookies ;
- bearer tokens ;
- données locales d'application ;
- bases SQLite, Kuzu ou LanceDB ;
- PDF générés avec données personnelles ;
- vrais CV ;
- captures contenant des secrets.

## Messages De Commit

Utilisez des messages clairs :

- `Add France Travail fixture`
- `Fix seniority cap for junior profiles`
- `Document France source setup`
- `Show source reliability on job cards`

Évitez :

- `updates`
- `fix stuff`
- `final changes`

## Questions

Ouvrez une issue si vous ne savez pas où placer un changement. Pour une idée de source, utilisez le template de demande de source et fournissez une URL publique d'exemple.
