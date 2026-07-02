import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const modal = readFileSync(new URL("./SettingsModal.tsx", import.meta.url), "utf8");
const globalPanel = readFileSync(new URL("./panels/GlobalSettings.tsx", import.meta.url), "utf8");
const sharedPanel = readFileSync(new URL("./panels/shared.tsx", import.meta.url), "utf8");
const discoveryPanel = readFileSync(new URL("./panels/DiscoverySettings.tsx", import.meta.url), "utf8");
const resumeTemplatesPanel = readFileSync(new URL("./panels/ResumeTemplatesPanel.tsx", import.meta.url), "utf8");
const httpError = readFileSync(new URL("../../shared/lib/httpError.ts", import.meta.url), "utf8");

describe("Settings UI contracts", () => {
  it("surfaces backend validation errors", () => {
    expect(modal).toContain("saveError");
    expect(modal).toContain("Les paramètres n'ont pas pu être enregistrés");
    expect(modal).toContain("responseErrorMessage(response");
    expect(modal).toContain("readableSettingsError");
    expect(modal).toContain("legalError");
    expect(modal).toContain("Le lien légal n'a pas pu être ouvert");
    expect(modal).toContain("openLegalLink");
    expect(modal).not.toContain("onClick={() => openUrl(l.href)}");
    expect(modal).toContain("savedTimerRef");
    expect(modal).toContain("window.clearTimeout(savedTimerRef.current)");
    expect(modal).toContain("saveWarning");
    expect(modal).toContain("Paramètres enregistrés, mais les notifications");
    expect(modal).not.toContain("Notification.requestPermission().catch(() => {})");
    expect(modal).toContain("Backend local injoignable");
    expect(modal).not.toContain("setSaveError(error instanceof Error ? error.message");
    expect(globalPanel).toContain("responseErrorMessage(r");
    expect(globalPanel).toContain("readJsonResponse<Record<string, SubStatus>>");
    expect(globalPanel).toContain("readJsonResponse<ValidationResult>");
    expect(globalPanel).toContain("Le statut d'abonnement a répondu dans un format illisible");
    expect(globalPanel).toContain("La vérification des clés a répondu dans un format illisible");
    expect(globalPanel).toContain("readableGlobalSettingsError");
    expect(globalPanel).toContain("Backend local injoignable");
    expect(globalPanel).toContain("Fournisseur d'abonnement inconnu");
    expect(globalPanel).toContain("unknown subscription provider");
    expect(globalPanel).toContain("Le CLI de ce fournisseur n'est pas installé");
    expect(globalPanel).toContain("cli provider is not installed");
    expect(globalPanel).not.toContain("setErr(e instanceof Error ? e.message");
    expect(globalPanel).not.toContain("setSubscriptionError(error instanceof Error ? error.message");
    expect(globalPanel).not.toContain("const d = await statusResponse.json()");
    expect(globalPanel).not.toContain("return r.json()");
    expect(globalPanel).not.toContain("setResults(await r.json())");
    expect(httpError).toContain("detailToMessage");
  });

  it("surfaces settings load errors instead of silently using defaults", () => {
    expect(modal).toContain("loadError");
    expect(modal).toContain("Les paramètres n'ont pas pu être chargés");
    expect(modal).toContain("readJsonResponse<Partial<Cfg>>");
    expect(modal).toContain("Les paramètres ont répondu dans un format illisible");
    expect(modal).toContain("Le serveur a renvoyé");
    expect(modal).toContain("Chargement requis");
    expect(modal).not.toContain("setLoadError(error instanceof Error ? error.message");
    expect(modal).not.toContain("return r.json()");
  });

  it("keeps dangerous maintenance errors actionable", () => {
    expect(modal).toContain("La réinitialisation n'a pas pu être lancée");
    expect(modal).toContain("La reconstruction des vecteurs a échoué");
    expect(modal).toContain("L'export des données a échoué");
    expect(modal).toContain("La restauration de la sauvegarde a échoué");
    expect(modal).toContain("settingsApi.exportData(api)");
    expect(modal).toContain("settingsApi.importData(api, importFile)");
    expect(modal).toContain("Tapez IMPORT pour confirmer");
    expect(modal).toContain("Réponse de restauration illisible");
    expect(modal).toContain("parseVectorRebuildSummary");
    expect(modal).toContain("readJsonResponse");
    expect(modal).toContain("Réponse de reconstruction illisible");
    expect(modal).not.toContain("setError(e instanceof Error ? e.message");
    expect(modal).not.toContain("setVectorError(e instanceof Error ? e.message");
    expect(modal).not.toContain("response.json().catch(() => ({}))");
    expect(modal).not.toContain("const data = await response.json()");
  });

  it("submits settings through the API client", () => {
    expect(modal).toContain("/api/v1/settings");
    expect(modal).toContain("method: \"POST\"");
  });

  it("keeps LLM provider fields in the global panel", () => {
    expect(globalPanel).toContain("llm_provider");
    expect(globalPanel).toContain("openai");
  });

  it("keeps embeddings independent from the chat provider", () => {
    expect(modal).toContain("EmbeddingSettings");
    expect(modal).toContain("embedding_provider");
    expect(modal).toContain("embedding_openai_api_key");
    expect(modal).toContain("text-embedding-3-small");
  });

  it("validates provider keys against the current form values", () => {
    expect(globalPanel).toContain("settingsApi.validate(api, cfg)");
  });

  it("surfaces configuration warnings from settings validation", () => {
    expect(globalPanel).toContain("_warnings");
    expect(globalPanel).toContain("validationWarnings");
    expect(globalPanel).toContain("subscriptionError");
    expect(globalPanel).toContain("Connexion non confirmée");
    expect(globalPanel).toContain("Le statut d'abonnement a renvoyé");
    expect(globalPanel).toContain("Statut d'abonnement indisponible");
    expect(globalPanel).toContain("Le statut d'abonnement n'a pas pu être chargé");
    expect(globalPanel).not.toContain("settingsApi.subscriptionStatus(api).then(r => r.json()).then(d => { if (alive) setSubStatus(d || {}); }).catch(() => {})");
  });

  it("keeps subscription login from updating closed settings panels", () => {
    expect(globalPanel).toContain("mountedRef");
    expect(globalPanel).toContain("mountedRef.current = false");
    expect(globalPanel).toContain("if (signingIn) return");
    expect(globalPanel).toContain("while (mountedRef.current && Date.now() - start < 120000)");
    expect(globalPanel).toContain("if (mountedRef.current) setSigningIn(false)");
  });

  it("auto-loads the model catalog in the picker (no manual button)", () => {
    // The picker fetches the always-current model list itself, on provider change.
    expect(sharedPanel).toContain("settingsApi.models(api, provider, cfg || {})");
    expect(sharedPanel).toContain("useEffect(() => { reload(); }");
    expect(sharedPanel).toContain("loadError");
    expect(sharedPanel).toContain("responseErrorMessage");
    expect(sharedPanel).toContain("readJsonResponse<Record<string, unknown>>");
    expect(sharedPanel).toContain("Catalogue modèles illisible");
    expect(sharedPanel).toContain("requestRef.current !== requestId");
    expect(sharedPanel).toContain("readableSettingsPanelError");
    expect(sharedPanel).toContain("Catalogue modèles indisponible");
    expect(sharedPanel).toContain("Aucun modèle ne correspond à cette recherche");
    expect(sharedPanel).not.toContain("return r.json()");
    // The stale "Load models" button is gone from the global panel.
    expect(globalPanel).not.toContain("Load models");
  });

  it("explains saved secrets and reveal failures", () => {
    expect(sharedPanel).toContain("revealError");
    expect(sharedPanel).toContain("Une clé est déjà enregistrée");
    expect(sharedPanel).toContain("Le secret enregistré n'a pas pu être affiché");
    expect(sharedPanel).toContain("readJsonResponse<{ value?: unknown }>");
    expect(sharedPanel).toContain("Réponse de révélation illisible");
    expect(sharedPanel).toContain("Le backend local n'a pas pu révéler ce secret");
    expect(sharedPanel).toContain("Secret inconnu");
    expect(sharedPanel).toContain("Aucun secret n'est enregistré pour ce champ");
    expect(sharedPanel).toContain("unknown secret");
    expect(sharedPanel).toContain("secret not configured");
    expect(sharedPanel).not.toContain("const data = await response.json()");
  });

  it("keeps discovery scan limit fields visible", () => {
    expect(discoveryPanel).toContain("x_max_requests_per_scan");
    expect(discoveryPanel).toContain("free_source_max_requests");
    expect(discoveryPanel).toContain("job_location");
    expect(discoveryPanel).toContain("job_search_radius_km");
    expect(discoveryPanel).toContain("Recherche ciblée");
    expect(discoveryPanel).toContain("Localisation cible");
    expect(discoveryPanel).toContain("siteFeedback");
    expect(discoveryPanel).toContain("Source ajoutée");
    expect(discoveryPanel).toContain("Cette source est déjà présente");
    expect(discoveryPanel).toContain("configuredSourceTargets");
    expect(discoveryPanel).toContain("sourceSummary");
    expect(discoveryPanel).toContain("Scan prévu");
    expect(discoveryPanel).toContain("Remplir avec ce preset");
    expect(discoveryPanel).toContain("Revenir au défaut");
    expect(discoveryPanel).toContain("Le champ peut rester vide");
    expect(discoveryPanel).toContain("Remplacer par ");
    expect(discoveryPanel).toContain("wttj:query=developpeur&aroundQuery=France");
    expect(discoveryPanel).toContain("apec:developpeur;location=France");
    expect(discoveryPanel).toContain("adzuna:developpeur;location=France;results=50");
    expect(discoveryPanel).toContain("jooble:developpeur;location=France");
  });

  it("keeps resume template management safe and localized", () => {
    expect(resumeTemplatesPanel).toContain("confirmDeleteId");
    expect(resumeTemplatesPanel).toContain("Confirmer");
    expect(resumeTemplatesPanel).toContain("responseErrorMessage(res");
    expect(resumeTemplatesPanel).toContain("readJsonResponse<unknown>");
    expect(resumeTemplatesPanel).toContain("readableTemplateError");
    expect(resumeTemplatesPanel).toContain("parseTemplatesResponse");
    expect(resumeTemplatesPanel).toContain("Réponse du backend illisible");
    expect(resumeTemplatesPanel).toContain("Backend local injoignable");
    expect(resumeTemplatesPanel).toContain("Format non supporté");
    expect(resumeTemplatesPanel).toContain("Modèle de CV introuvable");
    expect(resumeTemplatesPanel).toContain("not found");
    expect(resumeTemplatesPanel).toContain("Aucun modèle pour l'instant");
    expect(resumeTemplatesPanel).not.toContain("const body = await response.json()");
    expect(resumeTemplatesPanel).not.toContain("setError(err instanceof Error ? err.message");
    expect(resumeTemplatesPanel).not.toContain("res.json().catch(() => ({}))");
    expect(resumeTemplatesPanel).not.toContain("No templates yet");
    expect(resumeTemplatesPanel).not.toContain("Set default");
    expect(resumeTemplatesPanel).not.toContain('"Delete"');
  });
});
