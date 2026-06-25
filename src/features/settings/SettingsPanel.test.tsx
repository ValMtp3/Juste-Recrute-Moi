import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const modal = readFileSync(new URL("./SettingsModal.tsx", import.meta.url), "utf8");
const globalPanel = readFileSync(new URL("./panels/GlobalSettings.tsx", import.meta.url), "utf8");
const sharedPanel = readFileSync(new URL("./panels/shared.tsx", import.meta.url), "utf8");
const discoveryPanel = readFileSync(new URL("./panels/DiscoverySettings.tsx", import.meta.url), "utf8");

describe("Settings UI contracts", () => {
  it("surfaces backend validation errors", () => {
    expect(modal).toContain("saveError");
    expect(modal).toContain("Les paramètres n'ont pas pu être enregistrés");
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

  it("auto-loads the model catalog in the picker (no manual button)", () => {
    // The picker fetches the always-current model list itself, on provider change.
    expect(sharedPanel).toContain("settingsApi.models(api, provider, cfg || {})");
    expect(sharedPanel).toContain("useEffect(() => { reload(); }");
    // The stale "Load models" button is gone from the global panel.
    expect(globalPanel).not.toContain("Load models");
  });

  it("keeps discovery scan limit fields visible", () => {
    expect(discoveryPanel).toContain("x_max_requests_per_scan");
    expect(discoveryPanel).toContain("free_source_max_requests");
  });
});
