# MCP Juste Recrute Moi

Juste Recrute Moi expose un petit serveur MCP sur `stdio` pour les agents qui ont besoin d'evaluer ou d'enrichir des offres sans lancer toute l'application desktop.

## Demarrage

Depuis la racine du depot :

```powershell
backend\.venv\Scripts\python.exe backend\mcp_server.py
```

Dans la configuration client, remplacez `<CHEMIN_ABSOLU_DU_DEPOT>` par le chemin absolu de votre checkout local.

Le serveur implemente `initialize`, `tools/list` et `tools/call` en JSON-RPC delimite par ligne sur `stdio`.

## Outils disponibles

- `score_job_fit` : note une offre brute par rapport a un profil candidat Juste Recrute Moi.
- `evaluate_lead_quality` : applique la quality gate deterministe sur une offre normalisee.
- `extract_lead_intel` : extrait l'entreprise, la localisation, le budget, l'urgence, la stack et les signaux de qualite depuis un texte brut.

## Exemple de configuration client

```json
{
  "mcpServers": {
    "juste-recrute-moi": {
      "command": "<CHEMIN_ABSOLU_DU_DEPOT>\\backend\\.venv\\Scripts\\python.exe",
      "args": ["<CHEMIN_ABSOLU_DU_DEPOT>\\backend\\mcp_server.py"],
      "cwd": "<CHEMIN_ABSOLU_DU_DEPOT>"
    }
  }
}
```

La couche MCP doit rester petite et deterministe. Si un outil a besoin d'etat persistant, de PDF generes ou de scans longs, il vaut mieux exposer le sidecar FastAPI existant que dupliquer cette logique ici.
