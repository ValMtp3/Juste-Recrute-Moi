# Checklist de release Windows

La cible publique stable de cette passe est l'installateur desktop Windows. Les artefacts macOS et Linux peuvent continuer a etre construits en CI quand c'est possible, mais Windows reste le chemin de release prioritaire.

## Validation locale

Les machines locales servent a valider le comportement, pas a produire les installateurs publics signes :

```powershell
npm install
cd backend
uv sync --dev
cd ..
npm run release:smoke
npm run smoke:windows-update
```

`npm run release:smoke` est le controle local rapide recommande. Il construit le chemin frontend/backend de release et teste le sidecar sans demander les secrets de signature Tauri.

`npm run smoke:windows-update` lance les controles statiques Windows. Pour tester un vrai installateur :

```powershell
$env:JHM_WINDOWS_INSTALLER_SMOKE = "1"
$env:JHM_NEW_INSTALLER = "path\to\Juste-Recrute-Moi_<version>_x64-setup.exe"
npm run smoke:windows-update
```

Pour tester une mise a jour par-dessus une version deja installee :

```powershell
$env:JHM_WINDOWS_UPDATE_SMOKE = "1"
$env:JHM_OLD_INSTALLER = "path\to\previous\Juste-Recrute-Moi_<old>_x64-setup.exe"
$env:JHM_NEW_INSTALLER = "path\to\new\Juste-Recrute-Moi_<new>_x64-setup.exe"
npm run smoke:windows-update
```

## Packaging et signature

Le packaging Windows public et la signature updater doivent venir de GitHub Actions a partir d'un tag de release. Le workflow utilise ces secrets :

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, si la cle est chiffree

Ne perdez pas de temps a produire localement un installateur public signe. `npm run release:windows` et `npm run package:windows` ne sont utiles en local que pour une repetition explicite avec les variables de signature disponibles. Sinon, utilisez `npm run release:smoke` et laissez la CI taggee construire l'installateur.

| Artefact | Usage |
| --- | --- |
| `src-tauri/target/release/bundle/nsis/Juste-Recrute-Moi_<version>_x64-setup.exe` | Installateur Windows public construit par GitHub Actions |
| `src-tauri/target/release/juste-recrute-moi.exe` | Executable non bundle pour les smoke tests locaux |
| `release-assets/Juste-Recrute-Moi-runtime-pack-windows.zip` | Pack runtime obligatoire au premier lancement : LanceDB, PyArrow, recherche vectorielle, embeddings locaux et Playwright Chromium |
| `release-assets/Juste-Recrute-Moi-vector-runtime-windows.zip` | Artefact de compatibilite pour les anciennes versions |
| `release-assets/Juste-Recrute-Moi-browser-runtime-windows.zip` | Artefact de compatibilite pour les anciennes versions |

Ne construisez un MSI que pour un deploiement Windows administre :

```powershell
npm run package:windows:msi
```

## Controles CI obligatoires

Une release taggee doit verifier :

- les secrets de signature updater sont presents avant le packaging ;
- l'installateur Windows NSIS est produit par Tauri ;
- `latest.json` correspond au tag, aux artefacts uploades et aux fichiers `.sig` ;
- l'installateur fraichement construit s'installe dans un dossier temporaire ;
- le sidecar installe repond a `/health` avec app, sqlite et graphe OK ;
- le pack runtime obligatoire s'installe une seule fois, puis expose vector/browser OK ;
- le smoke de mise a jour par-dessus une version stable precedente passe quand un ancien installateur est disponible.

## Perimetre stable

Le coeur stable couvre le lancement de l'application, les reglages, le profil, l'agregation d'offres, le CRM local, le scoring deterministe et la generation de documents.

L'automatisation navigateur et l'auto-apply restent des fonctions de laboratoire, opt-in et experimentales. Elles ne doivent pas etre presentees comme le flux principal dans les notes de release.

## Smoke test manuel

- Installer sur une machine ou VM Windows propre.
- Ouvrir l'application sans outils developpeur.
- Accepter l'installation du pack runtime obligatoire et attendre la fin.
- Configurer Ollama local ou un fournisseur API.
- Importer un profil ou un CV.
- Lancer une recherche d'offres.
- Verifier que les offres affichent source, score et explication qualite.
- Generer un CV PDF, une lettre PDF et des brouillons de prise de contact.
- Confirmer que l'automatisation navigateur reste clairement experimentale et opt-in.
- Si une ancienne release est installee, verifier que la mise a jour preserve les donnees locales.

## Notes de release

Precisez si le build est l'installateur Windows stable. Ajoutez les SHA256 de chaque artefact publie. Les installateurs publics doivent etre construits par GitHub Actions depuis le tag, jamais uploades depuis une machine locale.
