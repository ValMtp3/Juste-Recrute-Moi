import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const modal = readFileSync(new URL("./SettingsModal.tsx", import.meta.url), "utf8");
const globalPanel = readFileSync(new URL("./panels/GlobalSettings.tsx", import.meta.url), "utf8");
const sharedPanel = readFileSync(new URL("./panels/shared.tsx", import.meta.url), "utf8");
const discoveryPanel = readFileSync(new URL("./panels/DiscoverySettings.tsx", import.meta.url), "utf8");
const resumeTemplatesPanel = readFileSync(new URL("./panels/ResumeTemplatesPanel.tsx", import.meta.url), "utf8");

describe("Settings UI contracts", () => {
  it("surfaces backend validation errors", () => {
    expect(modal).toContain("saveError");
    expect(modal).toContain("Les paramètres n'ont pas pu être enregistrés");
  });

  it("surfaces settings load errors instead of silently using defaults", () => {
    expect(modal).toContain("loadError");
    expect(modal).toContain("Les paramètres n'ont pas pu être chargés");
    expect(modal).toContain("Le serveur a renvoyé");
    expect(modal).toContain("Chargement requis");
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
  });

  it("auto-loads the model catalog in the picker (no manual button)", () => {
    // The picker fetches the always-current model list itself, on provider change.
    expect(sharedPanel).toContain("settingsApi.models(api, provider, cfg || {})");
    expect(sharedPanel).toContain("useEffect(() => { reload(); }");
    expect(sharedPanel).toContain("loadError");
    expect(sharedPanel).toContain("Catalogue modèles indisponible");
    expect(sharedPanel).toContain("Aucun modèle ne correspond à cette recherche");
    // The stale "Load models" button is gone from the global panel.
    expect(globalPanel).not.toContain("Load models");
  });

  it("explains saved secrets and reveal failures", () => {
    expect(sharedPanel).toContain("revealError");
    expect(sharedPanel).toContain("Une clé est déjà enregistrée");
    expect(sharedPanel).toContain("Le backend local n'a pas pu révéler ce secret");
  });

  it("keeps discovery scan limit fields visible", () => {
    expect(discoveryPanel).toContain("x_max_requests_per_scan");
    expect(discoveryPanel).toContain("free_source_max_requests");
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
  });

  it("keeps resume template management safe and localized", () => {
    expect(resumeTemplatesPanel).toContain("confirmDeleteId");
    expect(resumeTemplatesPanel).toContain("Confirmer");
    expect(resumeTemplatesPanel).toContain("Format non supporté");
    expect(resumeTemplatesPanel).toContain("Aucun modèle pour l'instant");
    expect(resumeTemplatesPanel).not.toContain("No templates yet");
    expect(resumeTemplatesPanel).not.toContain("Set default");
    expect(resumeTemplatesPanel).not.toContain('"Delete"');
  });
});
