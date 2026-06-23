import type { ApiFetch, Lead } from "./types";

export const leadsApi = {
  list: async (api: ApiFetch): Promise<Lead[]> => {
    const response = await api("/api/v1/leads");
    if (!response.ok) throw new Error("Impossible de charger les offres");
    return response.json();
  },
  delete: (api: ApiFetch, jobId: string) => api(`/api/v1/leads/${encodeURIComponent(jobId)}`, { method: "DELETE" }),
  reevaluate: (api: ApiFetch) => api("/api/v1/leads/reevaluate", { method: "POST" }),
  stopReevaluate: (api: ApiFetch) => api("/api/v1/leads/reevaluate/stop", { method: "POST" }),
  cleanup: (api: ApiFetch) => api("/api/v1/leads/cleanup", { method: "POST" }),
};
