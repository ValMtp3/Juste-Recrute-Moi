# Journal des changements

## 1.2.0 - 2026-06-23

- Renommage produit en Juste Recrute Moi.
- Transformation du fork en MVP d'agregateur d'offres pour le marche francais.
- Ajout du modele normalise `JobOffer`.
- Ajout de la source France Travail avec OAuth client credentials.
- Ajout de JobSpy en mode best effort pour Indeed et Google Jobs.
- Extension des ATS directs avec SmartRecruiters et Teamtailor, en plus de Greenhouse, Lever, Ashby et Workable.
- Ajout de l'import URL avec extraction JSON-LD `JobPosting` puis fallback HTML.
- Ajout de `backend/discovery/sources/sources.fr.json` pour configurer les sources France.
- Deduplication et mapping des offres vers les leads existants.
- Badges de fiabilite source dans l'interface.
- Traduction des principales surfaces produit en francais.
- Alignement des metadonnees du fork, du site public, de la documentation et du packaging.
- Completion de `.env.example` pour le developpement local et le MVP France.

## 1.1.x - Historique upstream conserve

- Generalisation du scoring et du parsing a plusieurs metiers.
- Ajout de la preference de localisation et du support remote/hybride/presentiel.
- Support de fournisseurs LLM avec ou sans cle API selon le mode choisi.
- Durcissement du sidecar desktop et des chemins de donnees locales.
- Ameliorations de l'ingestion CV, GitHub et portfolio.
- Ajout puis stabilisation du mode sombre.
- Corrections de generation PDF et de graph profile.
- Meilleure degradation quand les modeles IA ou les runtimes optionnels ne sont pas disponibles.

## 1.0.x - Socle initial

- Application desktop Tauri + React.
- Backend Python FastAPI local.
- Stockage local SQLite, graphe Kuzu et vecteurs LanceDB.
- Ingestion de profil, scoring, pipeline local et generation de documents.
- Runtime pack pour les dependances lourdes.
- Smoke tests de packaging et de mise a jour Windows.

Les details exhaustifs des anciennes releases appartiennent a l'historique Git upstream. Le fork public doit surtout documenter les changements propres a Juste Recrute Moi et les jalons utiles pour une release francaise.
