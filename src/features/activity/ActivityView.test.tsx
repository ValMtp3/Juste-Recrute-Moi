import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ActivityView.tsx", import.meta.url), "utf8");

describe("ActivityView UX contracts", () => {
  it("keeps log filters readable and counted", () => {
    expect(source).toContain("ACTIVITY_TABS");
    expect(source).toContain("tabCounts");
    expect(source).toContain("Dernier :");
    expect(source).toContain("événement");
  });

  it("keeps backend log internals translated for users", () => {
    expect(source).toContain("activityKindLabel");
    expect(source).toContain("activitySourceLabel");
    expect(source).toContain("Connexion");
    expect(source).toContain("Backend");
    expect(source).toContain("Collecte");
    expect(source).toContain("Adaptation");
  });

  it("does not expose raw clipboard errors", () => {
    expect(source).toContain("activityCopyErrorMessage");
    expect(source).toContain("Sélectionnez le texte du flux manuellement");
    expect(source).not.toContain("setCopyError(error instanceof Error");
  });
});
