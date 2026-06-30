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
    expect(source).toContain("cleanupConfirm");
    expect(source).toContain("Le nettoyage masque les lignes hors sujet");
    expect(source).toContain("Confirmer nettoyer");
  });

  it("keeps lead deletion available from the pipeline", () => {
    expect(source).toContain("deleteLead");
    expect(source).toContain("handleDeleteLead");
    expect(source).toContain("deletingLeadId");
    expect(source).toContain("Suppression de l'offre en cours");
    expect(source).toContain("La suppression de l'offre a échoué.");
    expect(source).toContain("readablePipelineError");
    expect(source).toContain("Identifiant d'offre invalide");
    expect(source).toContain("invalid job id format");
  });

  it("keeps export errors user-facing", () => {
    expect(source).toContain("responseErrorMessage");
    expect(source).toContain("L'export CSV n'a pas pu être préparé");
    expect(source).not.toContain("setExportErr(e instanceof Error ? e.message");
  });

  it("does not optimistically mark failed bulk status updates as applied", () => {
    expect(source).toContain("succeededIds");
    expect(source).toContain("succeededIds.forEach(job_id => emitAppEvent");
    expect(source).toContain("responseErrorMessage(response, `Marquage échoué");
    expect(source).toContain("failedResults[0].reason");
    expect(source).not.toContain("ids.forEach(job_id => emitAppEvent");
    expect(source).not.toContain("throw new Error(`Marquage échoué");
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
