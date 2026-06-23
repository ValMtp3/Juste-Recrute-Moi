import type { Lead } from "../types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function recordValue(value: unknown) {
  return isRecord(value) ? value : undefined;
}

export function parseLead(value: unknown): Lead | null {
  if (!isRecord(value)) return null;
  const jobId = text(value.job_id).trim();
  if (!jobId) return null;
  return {
    ...(value as Partial<Lead>),
    job_id: jobId,
    title: text(value.title, "Offre sans titre"),
    company: text(value.company, "Entreprise non renseignée"),
    url: text(value.url),
    platform: text(value.platform),
    status: text(value.status, "discovered"),
    asset: text(value.asset),
    score: numberValue(value.score),
    reason: text(value.reason),
    match_points: stringList(value.match_points) ?? [],
    gaps: stringList(value.gaps),
    signal_tags: stringList(value.signal_tags),
    selected_projects: stringList(value.selected_projects),
    tech_stack: stringList(value.tech_stack) ?? (value.tech_stack as Lead["tech_stack"]),
    source_meta: recordValue(value.source_meta) as Lead["source_meta"],
    events: Array.isArray(value.events) ? value.events as Lead["events"] : undefined,
  };
}

export function parseLeadsResponse(payload: unknown): Lead[] {
  const items = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.items)
      ? payload.items
      : null;
  if (!items) {
    throw new Error("Réponse API invalide : liste d'offres absente");
  }
  return items.map(parseLead).filter((lead): lead is Lead => Boolean(lead));
}
