# Checklist mainteneur de release

A utiliser avant de publier une release ou de partager un build.

Pour la strategie complete, voir [Roadmap de release production](PRODUCTION_RELEASE_ROADMAP.md).

## Controles locaux requis

- [ ] `pnpm install`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] `cd backend && uv run python -m pytest tests -q`
- [ ] `cd backend && uv run ruff check .`
- [ ] `cd src-tauri && cargo check`
- [ ] `pnpm release:smoke`
- [ ] `pnpm smoke:windows-update`

`pnpm release:smoke` est le chemin local normal. Une machine locale ne doit pas etre obligatoire pour produire un installateur public signe.

## Controles CI de release

- [ ] Le tag verifie la coherence des versions.
- [ ] Les secrets `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` sont presents si la signature updater est active.
- [ ] L'installateur Windows NSIS est produit par Tauri dans GitHub Actions.
- [ ] `latest.json` correspond au tag, aux artefacts et aux fichiers `.sig`.
- [ ] La CI installe l'installateur fraichement construit dans un dossier temporaire.
- [ ] Le sidecar installe repond a `/health`.
- [ ] Le smoke de mise a jour par-dessus une ancienne version passe quand un ancien installateur stable est disponible.

## Confidentialite et securite

- [ ] Aucun `.env`, secret, cookie, bearer token, CV prive, PDF genere, base locale, graphe, vecteur, donnees d'app ou sidecar package n'est committe.
- [ ] Les fixtures utilisent des donnees `.test`, pas des emails, telephones ou profils LinkedIn reels.
- [ ] L'automatisation navigateur et l'auto-apply sont presentes comme experimentaux et opt-in.
- [ ] Les notes de release decrivent Juste Recrute Moi comme local-first, sans backend heberge implicite.
- [ ] Les SHA256 de chaque artefact public sont publies.
- [ ] Les secrets de signature Tauri restent dans l'environnement GitHub Actions.
- [ ] Les capabilities Tauri restent limitees.
- [ ] Le sidecar ecoute sur `127.0.0.1` et exige le jeton runtime.

## Deroule de release

1. Mettre les versions a jour avec `pnpm version:bump -- X.Y.Z`.
2. Lancer les controles locaux.
3. Creer un tag `vX.Y.Z`.
4. Pousser le tag et laisser la CI construire, signer, verifier et publier.
5. Installer le build Windows produit par GitHub Actions avant de partager le lien.
6. Si une release precedente existe, verifier que la mise a jour conserve les donnees locales.
