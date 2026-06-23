import { describe, expect, it } from "vitest";
import { parseLead, parseLeadsResponse } from "./validation";

describe("validation API des offres", () => {
  it("normalise une offre minimale valide", () => {
    expect(parseLead({ job_id: "job-1", title: "Dev", score: 42 })?.company).toBe("Entreprise non renseignée");
    expect(parseLead({ job_id: "job-1", title: "Dev", score: 42 })?.match_points).toEqual([]);
  });

  it("rejette les lignes sans identifiant stable", () => {
    expect(parseLead({ title: "Dev" })).toBeNull();
    expect(parseLead(null)).toBeNull();
  });

  it("lit les réponses paginées ou directes", () => {
    const direct = parseLeadsResponse([{ job_id: "a", title: "A" }]);
    const paged = parseLeadsResponse({ items: [{ job_id: "b", title: "B" }], total: 1 });
    expect(direct.map(lead => lead.job_id)).toEqual(["a"]);
    expect(paged.map(lead => lead.job_id)).toEqual(["b"]);
  });

  it("échoue explicitement quand la forme de réponse ne contient pas de liste", () => {
    expect(() => parseLeadsResponse({ data: [] })).toThrow("liste d'offres absente");
  });
});
