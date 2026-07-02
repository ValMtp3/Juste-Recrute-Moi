import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./IngestionView.tsx", import.meta.url), "utf8");

describe("IngestionView UX contracts", () => {
  it("keeps import errors translated and actionable", () => {
    expect(source).toContain("readableIngestionError");
    expect(source).toContain("sharedResponseErrorMessage");
    expect(source).toContain("Backend local injoignable");
    expect(source).toContain("Fichier trop volumineux");
    expect(source).toContain("Limite GitHub atteinte");
    expect(source).toContain("Token GitHub invalide");
    expect(source).toContain("JSON invalide");
    expect(source).toContain("Certains champs ne respectent pas le format attendu");
  });

  it("does not stringify structured backend validation details directly", () => {
    expect(source).not.toContain("JSON.stringify(detail) : `Import échoué");
    expect(source).not.toContain("const data = await response.clone().json()");
    expect(source).not.toContain("function detailToMessage");
    expect(source).toContain("const message = await sharedResponseErrorMessage(response, fallback);");
    expect(source).toContain("return readableIngestionError(message, response.status);");
  });

  it("keeps JSON template and import failures actionable", () => {
    expect(source).toContain("responseErrorMessage(r, \"Le modèle n'a pas pu être téléchargé.\")");
    expect(source).toContain("Le modèle de profil a répondu dans un format illisible");
    expect(source).toContain("setJsonError(requestErrorMessage(err, \"Le modèle n'a pas pu être téléchargé.\"))");
    expect(source).toContain("setJsonError(requestErrorMessage(err, \"Le profil JSON n'a pas pu être importé.\"))");
    expect(source).not.toContain("const data = await r.json()");
    expect(source).not.toContain("Téléchargement du modèle échoué (${r.status})");
    expect(source).not.toContain("setJsonError(\"Le profil JSON n'a pas pu être importé.\")");
  });

  it("does not silently ignore saved resume template load failures", () => {
    expect(source).toContain("responseErrorMessage(r, \"Le modèle de CV n'a pas pu être chargé.\")");
    expect(source).toContain("readJsonResponse<{ template?: string }>");
    expect(source).toContain("Le modèle de CV a répondu dans un format illisible");
    expect(source).toContain("setErrorMessage(requestErrorMessage(err, \"Le modèle de CV n'a pas pu être chargé.\"))");
    expect(source).toContain("setTemplateLoaded(true)");
    expect(source).not.toContain(".catch(() => {})");
    expect(source).not.toContain("return r.json()");
  });

  it("does not treat unreadable successful import responses as completed imports", () => {
    expect(source).toContain("parseSuccessfulIngestionJson");
    expect(source).toContain("readJsonResponse");
    expect(source).toContain("Réponse du backend illisible");
    expect(source).not.toContain("return await response.json()");
    expect(source).not.toContain("r.json().catch(() => ({}))");
  });
});
