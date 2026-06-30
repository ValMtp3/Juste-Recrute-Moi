import { describe, expect, it, vi } from "vitest";
import { leadsApi } from "./leads";
import type { ApiFetch } from "./types";

describe("leadsApi", () => {
  it("charge et normalise les offres", async () => {
    const api = vi.fn<ApiFetch>().mockResolvedValue(new Response(JSON.stringify([
      { job_id: "job-1", title: "Dev", score: 42 },
    ])));

    await expect(leadsApi.list(api)).resolves.toMatchObject([
      { job_id: "job-1", title: "Dev", company: "Entreprise non renseignée" },
    ]);
    expect(api).toHaveBeenCalledWith("/api/v1/leads");
  });

  it("remonte le détail lisible du backend", async () => {
    const api = vi.fn<ApiFetch>().mockResolvedValue(new Response(
      JSON.stringify({ detail: "Base offres indisponible" }),
      { status: 503 },
    ));

    await expect(leadsApi.list(api)).rejects.toThrow("Base offres indisponible");
  });

  it("remplace une réponse illisible par un message actionnable", async () => {
    const api = vi.fn<ApiFetch>().mockResolvedValue(new Response("{", { status: 200 }));

    await expect(leadsApi.list(api)).rejects.toThrow("Les offres ont répondu dans un format illisible");
  });
});
