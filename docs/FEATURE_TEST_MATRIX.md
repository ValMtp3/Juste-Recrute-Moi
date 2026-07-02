# Matrice de tests

Cette matrice relie les fonctions principales de Juste Recrute Moi aux tests qui les couvrent. Elle sert a verifier que le produit reste un agregateur local-first fiable, pas seulement un outil de suivi manuel.

## Verification complete

```bash
# Backend
cd backend
uv run python -m pytest tests -q
uv run ruff check .

# Frontend
pnpm typecheck
pnpm test
pnpm build

# Desktop
cd src-tauri
cargo check
```

## Profil candidat

| Fonction | Preuve |
| --- | --- |
| Import PDF/DOCX/TXT/MD | `backend/tests/test_ingestor_documents.py` |
| Parsing local sans LLM | `backend/tests/test_field_location_agnostic.py` |
| Import texte/API | `backend/tests/test_profile_service.py`, `backend/tests/test_regression_api_profile.py` |
| Import JSON et template | `backend/tests/test_profile_template.py` |
| Import GitHub | `backend/tests/test_github_ingestor.py` |
| Import portfolio avec garde SSRF | `backend/tests/test_portfolio_ingestor.py`, `backend/tests/test_url_guard.py` |
| Deduplication a la re-ingestion | `backend/tests/test_ingestion_dedup.py` |
| Graphe Kuzu et vecteurs LanceDB | `backend/tests/test_graph.py`, `backend/tests/test_profile_delete_consistency.py`, `backend/tests/test_profile_correlations.py` |
| Parcours ingest -> score -> generation | `backend/tests/test_e2e_profile_score_generate.py` |

## Agregation d'offres

| Fonction | Preuve |
| --- | --- |
| Modele normalise `JobOffer` | `backend/tests/test_france_job_aggregator_sources.py` |
| France Travail | `backend/tests/test_france_job_aggregator_sources.py` |
| JobSpy en best effort | `backend/tests/test_france_job_aggregator_sources.py` |
| ATS Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Teamtailor | `backend/tests/test_discovery_sources.py`, `backend/tests/test_france_job_aggregator_sources.py` |
| Import URL JSON-LD / HTML | `backend/tests/test_france_job_aggregator_sources.py` |
| URL canonique et deduplication | `backend/tests/test_dedup_canonical.py`, `backend/tests/test_france_job_aggregator_sources.py` |
| Quality gate neutre | `backend/tests/test_regression_targets_quality.py`, `backend/tests/test_quality_gate_freshness.py` |
| Ecritures async pendant le scan | `backend/tests/test_discovery_async_db.py` |

## Scoring et classement

| Fonction | Preuve |
| --- | --- |
| Invariants du scoring deterministe | `backend/tests/test_scoring_engine_invariants.py` |
| Scoring agnostique du metier | `backend/tests/test_field_location_agnostic.py` |
| Evaluation LLM et criteres | `backend/tests/test_ranking_evaluator.py`, `backend/tests/test_ranking_criteria.py`, `backend/tests/test_ranking_service.py` |
| Matching semantique et fallback | `backend/tests/test_regression_ranking_semantic.py`, `backend/tests/test_semantic_mode_surfacing.py` |
| Apprentissage depuis feedback | `backend/tests/test_data_feedback.py`, `backend/tests/test_regression_feedback_automation.py` |

## Generation de documents

| Fonction | Preuve |
| --- | --- |
| CV PDF adapte | `backend/tests/test_generation_service.py`, `backend/tests/test_workflow_action_versions.py` |
| Lettre PDF adaptee | `backend/tests/test_generation_generators.py` |
| Messages courts, LinkedIn, email | `backend/tests/test_generation_non_tech_artifacts.py` |
| Rendu PDF sans debordement | `backend/tests/test_regression_generation_pdf.py` |
| Templates de CV | `backend/tests/test_resume_templates.py` |
| Degradation LLM controlee | `backend/tests/test_generation_service.py`, `backend/tests/test_phase3_degradation.py` |

## Pipeline local et interface

| Fonction | Preuve |
| --- | --- |
| Cycle de vie des offres | `backend/tests/test_api.py`, `backend/tests/test_phase2_data_safety.py` |
| Ouverture d'URL originale avec garde de scheme | `backend/tests/test_automation_service.py`, `backend/tests/test_actuator_vision_safety.py` |
| WebSocket auth et evenements | `backend/tests/test_ws_auth.py` |
| Store atomique et historique | `backend/tests/test_job_store_atomic.py`, `backend/tests/test_prune_history.py` |
| Reglages persistants | `backend/tests/test_sqlite_settings.py`, `backend/tests/test_settings_validation.py` |
| Composants UI | `pnpm test` |

## Securite, packaging et runtime

| Fonction | Preuve |
| --- | --- |
| Garde SSRF, garde scheme, auth WS | `backend/tests/test_security_hardening.py`, `backend/tests/test_url_guard.py` |
| Pools, ports, rate limit | `backend/tests/test_connection_pool_reap.py`, `backend/tests/test_sqlite_pool.py`, `backend/tests/test_port_reserve.py`, `backend/tests/test_rate_limit_retry_after.py` |
| Frontieres d'import | `backend/tests/test_import_boundaries.py`, `backend/tests/test_stability_manifest.py` |
| Serveur MCP | `backend/tests/test_mcp_server.py` |
| Runtime navigateur experimente | `backend/tests/test_browser_runtime.py`, `backend/tests/test_actuator_vision_safety.py` |

## Derniere validation locale connue

Les resultats exacts doivent etre relances avant une release. La validation recente du fork a couvert :

- tests backend cibles agregateur/connecteurs/mappers ;
- `pnpm test` ;
- `pnpm typecheck` ;
- `pnpm build` ;
- `pnpm lint` sans erreur bloquante ;
- `cargo check` avec le linker macOS configure.
