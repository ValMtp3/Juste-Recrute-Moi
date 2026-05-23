import type { ApiFetch } from "./types";

export const GENERATION_TIMEOUT_MS = 180000;

export const generationApi = {
  generate: (api: ApiFetch, jobId: string, templateId = "") => api(
    `/api/v1/leads/${encodeURIComponent(jobId)}/generate${templateId ? `?template_id=${encodeURIComponent(templateId)}` : ""}`,
    { method: "POST", timeoutMs: GENERATION_TIMEOUT_MS },
  ),
  getTemplate: (api: ApiFetch) => api("/api/v1/template"),
  saveTemplate: (api: ApiFetch, template: string) => api("/api/v1/template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template }),
  }),
};
