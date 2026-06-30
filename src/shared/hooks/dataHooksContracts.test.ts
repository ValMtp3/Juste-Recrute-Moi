import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const useLeads = readFileSync(new URL("./useLeads.ts", import.meta.url), "utf8");
const useGraphStats = readFileSync(new URL("./useGraphStats.ts", import.meta.url), "utf8");
const useDueFollowups = readFileSync(new URL("./useDueFollowups.ts", import.meta.url), "utf8");

describe("data hook stability contracts", () => {
  it("keeps lead loading errors user-facing and centralized", () => {
    expect(useLeads).toContain("responseErrorMessage");
    expect(useLeads).toContain("readJsonResponse");
    expect(useLeads).toContain("Les offres ont répondu dans un format illisible");
    expect(useLeads).toContain("L'historique d'activité a répondu dans un format illisible");
    expect(useLeads).toContain("readableLeadsError");
    expect(useLeads).toContain("readableEventsError");
    expect(useLeads).toContain("readableLeadNotificationError");
    expect(useLeads).toContain("Backend local injoignable");
    expect(useLeads).toContain("Historique d'activité indisponible");
    expect(useLeads).toContain('addLog?.(readableEventsError(error), "system", "events")');
    expect(useLeads).toContain('addLog?.(readableLeadNotificationError(error), "system", "notifications")');
    expect(useLeads).toContain("Les offres n'ont pas pu être chargées");
    expect(useLeads).not.toContain("setError(e instanceof Error ? e.message");
    expect(useLeads).not.toContain(".catch(() => {})");
    expect(useLeads).not.toContain("const data = await r.json()");
    expect(useLeads).not.toContain(".then(r => r.json())\n      .then((evts:");
    expect(useLeads).not.toContain("r.json().then");
  });

  it("keeps graph loading errors user-facing and centralized", () => {
    expect(useGraphStats).toContain("responseErrorMessage");
    expect(useGraphStats).toContain("readJsonResponse");
    expect(useGraphStats).toContain("Le graphe a répondu dans un format illisible");
    expect(useGraphStats).toContain("readableGraphError");
    expect(useGraphStats).toContain("Backend local injoignable");
    expect(useGraphStats).toContain("Le graphe n'a pas pu être chargé");
    expect(useGraphStats).not.toContain("Graph request failed (${response.status})${detail");
    expect(useGraphStats).not.toContain("error instanceof Error ? error.message : \"Graph request failed\"");
    expect(useGraphStats).not.toContain("const data = await response.json()");
  });

  it("keeps due followup loading failures visible without breaking the dashboard counter", () => {
    expect(useDueFollowups).toContain("responseErrorMessage");
    expect(useDueFollowups).toContain("readJsonResponse");
    expect(useDueFollowups).toContain("readableDueFollowupsError");
    expect(useDueFollowups).toContain("Relances dues indisponibles");
    expect(useDueFollowups).toContain("Les relances dues ont répondu dans un format illisible");
    expect(useDueFollowups).toContain("lastLoggedErrorRef");
    expect(useDueFollowups).toContain("new AbortController()");
    expect(useDueFollowups).toContain("isAbortLikeError");
    expect(useDueFollowups).toContain('addLog?.(message, "system", "followups")');
    expect(useDueFollowups).not.toContain(".then(r => (r.ok ? r.json() : null))");
    expect(useDueFollowups).not.toContain("return r.json()");
    expect(useDueFollowups).not.toContain(".catch(() => {})");
  });
});
