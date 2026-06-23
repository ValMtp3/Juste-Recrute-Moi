# Backend Juste Recrute Moi

Backend Python local de l'application Juste Recrute Moi.

## Responsabilités

- API HTTP/WebSocket FastAPI ;
- persistance CRM locale ;
- collecte des sources d'offres ;
- filtre qualité des leads ;
- ranking déterministe et sémantique ;
- ingestion du profil dans le graphe et les vecteurs ;
- génération de CV, lettres et messages d'approche.

## Installation

Depuis la racine du dépôt :

```bash
cd backend
uv sync --dev
```

## Tests

Windows :

```bash
backend/.venv/Scripts/python.exe -m pytest backend/tests
```

macOS/Linux :

```bash
backend/.venv/bin/python -m pytest backend/tests
```

Dans le sandbox Codex, utilisez un cache local :

```bash
cd backend
UV_CACHE_DIR=../.uv-cache uv run python -m pytest tests -q
```

## Données Sensibles

Le backend manipule des données locales via SQLite, Kuzu, LanceDB et des fichiers générés. Ne commitez jamais les données d'application, stores vectoriels, graphes, PDF générés, clés API, cookies ou CV privés.
