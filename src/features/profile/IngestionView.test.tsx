import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./IngestionView.tsx", import.meta.url), "utf8");

describe("IngestionView UX contracts", () => {
  it("keeps import errors translated and actionable", () => {
    expect(source).toContain("readableIngestionError");
    expect(source).toContain("detailToMessage");
    expect(source).toContain("Backend local injoignable");
    expect(source).toContain("Fichier trop volumineux");
    expect(source).toContain("Limite GitHub atteinte");
    expect(source).toContain("Token GitHub invalide");
    expect(source).toContain("JSON invalide");
    expect(source).toContain("Certains champs ne respectent pas le format attendu");
  });

  it("does not stringify structured backend validation details directly", () => {
    expect(source).not.toContain("JSON.stringify(detail) : `Import échoué");
    expect(source).toContain("readableIngestionError(detailToMessage(detail)");
  });
});
