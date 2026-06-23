# Architecture

Juste Recrute Moi est une application desktop local-first composee d'un shell Tauri, d'une interface React et d'un sidecar Python FastAPI.

## Flux principal

```text
Profil candidat
  -> graphe Kuzu + vecteurs LanceDB
  -> connecteurs d'offres
  -> normalisation JobOffer
  -> filtre qualite
  -> deduplication
  -> scoring profil/offre
  -> pipeline local et generation de documents
```

## Frontend

L'application React dans `src/` gere :

- la navigation et les vues de travail ;
- les cartes d'offres, filtres et badges de source ;
- les reglages ;
- les ecrans profil et import ;
- le pipeline local ;
- l'affichage des evenements WebSocket.

Le frontend communique avec le backend via des requetes HTTP locales authentifiees. Tauri fournit le port du backend et le jeton runtime au demarrage.

## Backend

Le backend Python dans `backend/` gere :

- les routes FastAPI ;
- les connecteurs d'offres ;
- la normalisation vers `JobOffer` ;
- la quality gate ;
- la deduplication ;
- le scoring et l'evaluation ;
- l'ingestion de profil ;
- la recherche vectorielle de secours ;
- la generation de CV, lettres et messages ;
- la persistance locale.

Modules importants :

- `backend/discovery/sources/` : connecteurs France Travail, ATS, JobSpy, import URL et sources best effort ;
- `backend/discovery/sources/common.py` : modele normalise et helpers communs ;
- `backend/discovery/quality_gate.py` : controle qualite avant enregistrement ;
- `backend/ranking/scoring_engine.py` : scoring deterministe ;
- `backend/ranking/semantic.py` : matching semantique LanceDB avec fallback ;
- `backend/generation/service.py` et `backend/generation/generators/` : generation des documents et messages ;
- `backend/data/repository.py` : facade de persistance locale ;
- `backend/data/sqlite/`, `backend/data/graph/`, `backend/data/vector/` : acces SQLite, Kuzu et LanceDB.

## Stockage local

Les donnees locales incluent :

- SQLite pour les offres, reglages, evenements et metadonnees ;
- Kuzu pour le graphe profil ;
- LanceDB pour les vecteurs ;
- des fichiers locaux pour les documents generes.

Ces donnees ne doivent jamais etre commitees ni jointes a une issue publique.

## Automatisation experimentale

L'automatisation navigateur reste un laboratoire contributeur. Le coeur stable du produit est l'agregation d'offres, le scoring, la revue locale et la generation de documents.
