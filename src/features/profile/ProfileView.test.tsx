import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ProfileView.tsx", import.meta.url), "utf8");

describe("ProfileView UX contracts", () => {
  it("does not treat unreadable successful profile mutations as completed actions", () => {
    expect(source).toContain("parseSuccessfulProfileJson");
    expect(source).toContain("readJsonResponse");
    expect(source).toContain("Réponse du backend illisible");
    expect(source).not.toContain("const data = await r.json()");
    expect(source).not.toContain("return await response.json()");
    expect(source).not.toContain("res.json().catch(() => ({}))");
  });

  it("keeps stale backend validation errors localized", () => {
    expect(source).toContain("Ajoutez au moins un nom ou un résumé de profil");
    expect(source).toContain("Le nom de la compétence est obligatoire");
    expect(source).toContain("Le titre du projet est obligatoire");
    expect(source).toContain("Le titre de la formation est obligatoire");
    expect(source).toContain("Le titre de la certification est obligatoire");
    expect(source).toContain("Le titre de la réalisation est obligatoire");
    expect(source).toContain("name or summary is required");
    expect(source).toContain("skill name is required");
  });
});
