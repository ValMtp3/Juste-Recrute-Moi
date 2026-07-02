import type { ApiFetch, Lead } from "./types";
import { readJsonResponse, responseErrorMessage } from "../shared/lib/httpError";
import { parseLeadsResponse } from "./validation";

export const leadsApi = {
  list: async (api: ApiFetch): Promise<Lead[]> => {
    const response = await api("/api/v1/leads");
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response, "Impossible de charger les offres"));
    }
    const payload = await readJsonResponse(
      response,
      "Les offres ont répondu dans un format illisible. Vérifiez Activité, puis réessayez.",
    );
    return parseLeadsResponse(payload);
  },
  delete: (api: ApiFetch, jobId: string) => api(`/api/v1/leads/${encodeURIComponent(jobId)}`, { method: "DELETE" }),
  reevaluate: (api: ApiFetch) => api("/api/v1/leads/reevaluate", { method: "POST" }),
  stopReevaluate: (api: ApiFetch) => api("/api/v1/leads/reevaluate/stop", { method: "POST" }),
  cleanup: (api: ApiFetch) => api("/api/v1/leads/cleanup", { method: "POST" }),
};
