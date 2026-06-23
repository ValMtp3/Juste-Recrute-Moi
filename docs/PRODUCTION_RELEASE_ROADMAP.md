# Roadmap de release production

Cette roadmap transforme le fork actuel en produit distribuable : installateurs stables, mises a jour signees, builds reproductibles et garde-fous avant publication.

## Principes

- Construire les releases depuis des tags CI, pas depuis un laptop mainteneur.
- Garder le comportement local-first : profil, offres, documents, reglages, cles API et donnees locales restent sur la machine utilisateur.
- Separer le coeur stable des fonctions experimentales.
- Automatiser les controles repetables plutot que s'appuyer sur la memoire du mainteneur.
- Eviter de promettre comme stable les connecteurs fragiles ou l'automatisation navigateur.

## Forme cible

| Zone | Cible |
| --- | --- |
| Windows | Installateur NSIS public |
| macOS | Builds signes et notarises Apple Silicon puis Intel si maintenu |
| Linux | AppImage et `.deb` |
| Mises a jour | Artefacts Tauri updater signes |
| Canaux | `stable`, `beta`, `nightly` |
| Backend | Sidecar Python bundle |
| Runtime lourd | Pack runtime telecharge au premier lancement |
| Source de release | GitHub Actions depuis tags `v*` |

## Ecarts actuels

- Les versions sont reparties entre `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `backend/pyproject.toml` et les lockfiles.
- La signature macOS publique n'est pas encore industrialisee.
- Les manifests updater doivent couvrir toutes les plateformes publiees.
- Le sidecar et les dependances lourdes peuvent grossir l'installateur.
- Les smoke tests installateur sont encore partiellement manuels.
- Les canaux de mise a jour ne sont pas encore separes.

## Phase 0 - Definition de pret-a-release

Objectif : rendre la notion de release publiable explicite.

Critere minimal :

- typecheck frontend OK ;
- tests frontend OK ;
- build frontend OK ;
- tests backend OK ;
- ruff backend OK ;
- `cargo check` OK ;
- sidecar lance et repond a `/health` ;
- installateur construit par CI ;
- updater signe et verifie ;
- notes de release et checksums publies.

## Phase 1 - Source unique de version

Objectif : un tag `vX.Y.Z` doit correspondre a toutes les versions du depot.

Actions :

- utiliser `npm run version:bump -- X.Y.Z` ;
- verifier `npm run version:check` en CI ;
- refuser une release si un fichier versionne diverge du tag.

## Phase 2 - Builds clairs

Objectif : separer validation rapide et packaging public.

Commandes attendues :

- `npm run build` pour le frontend ;
- `npm run build:sidecar` pour le sidecar ;
- `npm run release:smoke` pour la validation locale ;
- workflows CI tagges pour les installateurs publics.

## Phase 3 - Sidecar et runtime

Objectif : garder l'installateur raisonnable sans casser le premier lancement.

Actions :

- pack runtime obligatoire pour LanceDB, PyArrow, embeddings locaux et Playwright Chromium ;
- verification du manifest runtime ;
- reprise propre si le telechargement echoue ;
- message utilisateur clair en cas d'installation incomplete.

## Phase 4 - Installateurs

Objectif : chaque OS publie un artefact utilisable.

Windows :

- NSIS par defaut ;
- smoke installateur en CI ;
- test de mise a jour par-dessus une ancienne version.

macOS :

- signature developpeur ;
- notarisation ;
- verification Apple Silicon puis Intel si supporte.

Linux :

- AppImage ;
- `.deb` ;
- smoke de lancement.

## Phase 5 - Updater

Objectif : une mise a jour ne doit pas casser les donnees locales.

Actions :

- signer les artefacts updater ;
- verifier `latest.json` contre les assets publies ;
- tester installation propre et mise a jour ;
- conserver une procedure de rollback.

## Phase 6 - Observabilite sans atteinte a la vie privee

Objectif : comprendre les echecs de release sans telemetrie intrusive.

Actions :

- logs locaux lisibles ;
- codes d'erreur utilisateur ;
- diagnostic exportable volontairement ;
- aucune collecte automatique de CV, offres, cles ou documents.

## Gate de production

Avant publication stable :

- [ ] Toutes les validations locales passent.
- [ ] La CI taggee construit les artefacts.
- [ ] Les artefacts sont signes quand requis.
- [ ] Les checksums sont publies.
- [ ] Le premier lancement installe le runtime requis.
- [ ] Les donnees locales survivent a une mise a jour.
- [ ] Les notes de release distinguent clairement stable, best effort et experimental.

## Priorite pour Juste Recrute Moi

Pour la v1 France, la priorite n'est pas d'ajouter plus de scraping fragile. Il faut d'abord stabiliser :

1. France Travail avec vraies cles et erreurs comprehensibles.
2. ATS directs et fixtures representatives.
3. Import URL fiable pour les jobboards francais.
4. Deduplication et explication de rejet.
5. Build Windows installe proprement.
6. Documentation et licence AGPL propres.
