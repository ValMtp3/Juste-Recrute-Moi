import { useEffect, useRef, useState } from "react";
import { isAbortLikeError } from "../../api/client";
import type { ApiFetch, Lead, LogLine } from "../../types";
import { readJsonResponse, responseErrorMessage } from "../lib/httpError";

function readableDueFollowupsError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return "Les relances dues n'ont pas pu être chargées.";
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("backend local")) {
    return "Relances dues indisponibles : backend local injoignable.";
  }
  if (lower.includes("relances") || lower.includes("followups")) {
    return "Les relances dues n'ont pas pu être chargées. Le tableau de bord reste utilisable.";
  }
  return trimmed;
}

export function useDueFollowups(api: ApiFetch | null, addLog?: (msg: string, kind: LogLine["kind"], src?: string) => void) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const lastLoggedErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!api) {
      setLeads([]);
      lastLoggedErrorRef.current = null;
      return;
    }
    let alive = true;
    const controller = new AbortController();
    const load = () => api(`/api/v1/followups/due?limit=25`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(await responseErrorMessage(r, `Relances dues indisponibles (${r.status})`));
        return readJsonResponse(
          r,
          "Les relances dues ont répondu dans un format illisible.",
        );
      })
      .then(data => {
        if (!alive) return;
        // Error bodies are {detail: ...}; storing one as the list would make
        // every consumer's .length/.map blow up.
        if (!Array.isArray(data)) throw new Error("Relances dues invalides");
        lastLoggedErrorRef.current = null;
        setLeads(data);
      })
      .catch(error => {
        if (!alive) return;
        if (controller.signal.aborted || isAbortLikeError(error)) return;
        const message = readableDueFollowupsError(error);
        if (lastLoggedErrorRef.current === message) return;
        lastLoggedErrorRef.current = message;
        addLog?.(message, "system", "followups");
      });
    load();
    const interval = setInterval(load, 60000);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [api, addLog]);
  return leads;
}
