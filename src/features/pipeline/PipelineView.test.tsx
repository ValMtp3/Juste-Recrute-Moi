import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./PipelineView.tsx", import.meta.url), "utf8");

describe("PipelineView critical UI contracts", () => {
  it("renders an empty state for no leads", () => {
    expect(source).toContain("Aucune offre");
  });

  it("keeps empty-state recovery actions available", () => {
    expect(source).toContain("Scanner maintenant");
    expect(source).toContain("Adapter une offre");
    expect(source).toContain("Effacer les filtres");
  });

  it("keeps reevaluation controls wired", () => {
    expect(source).toContain("onReevaluate");
    expect(source).toContain("onStopReevaluate");
  });

  it("keeps cleanup controls wired", () => {
    expect(source).toContain("onCleanup");
    expect(source).toContain("cleaning");
  });

  it("keeps lead deletion available from the pipeline", () => {
    expect(source).toContain("deleteLead");
  });

  it("keeps bulk action feedback inline instead of blocking alerts", () => {
    expect(source).toContain("bulkNotice");
    expect(source).toContain("bulkConfirmDelete");
    expect(source).toContain("Confirmez la suppression définitive");
    expect(source).toContain("Suppression...");
    expect(source).toContain("Marquage...");
    expect(source).not.toContain("window.confirm");
    expect(source).not.toContain("alert(");
  });
});
