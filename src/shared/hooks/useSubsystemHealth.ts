import { useEffect, useState } from "react";
import type { ApiFetch } from "../../types";
import { onAppEvent } from "../lib/appEvents";
import { readJsonResponse, responseErrorMessage } from "../lib/httpError";

export type SubsystemHealth = Record<string, { status: string; error?: string; reason?: string; [key: string]: unknown }>;

function healthStatusFallback(status: number) {
  return `La santé des sous-systèmes n'a pas pu être chargée (${status}).`;
}

function readableHealthError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : String(error || "").trim();
  if (!message) return "La santé des sous-systèmes n'a pas pu être chargée.";
  const lower = message.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("backend local") || lower.includes("load failed")) {
    return "Backend local injoignable. Les statuts seront réessayés automatiquement.";
  }
  return message;
}

function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

export function useSubsystemHealth(api: ApiFetch | null) {
  const [subsystems, setSubsystems] = useState<SubsystemHealth | null>(null);

  useEffect(() => {
    if (!api) {
      setSubsystems(null);
      return;
    }
    let stopped = false;
    const load = async () => {
      if (!isDocumentVisible()) return;
      try {
        const response = await api("/api/v1/health/subsystems", { timeoutMs: 10000 });
        if (!response.ok) {
          throw new Error(await responseErrorMessage(response, healthStatusFallback(response.status)));
        }
        const payload = await readJsonResponse<SubsystemHealth>(
          response,
          "La santé des sous-systèmes a répondu dans un format illisible.",
        );
        if (!stopped) setSubsystems(payload);
      } catch (error) {
        if (!stopped) {
          setSubsystems({
            backend: {
              status: "unavailable",
              error: readableHealthError(error),
            },
          });
        }
      }
    };
    const refreshWhenVisible = () => {
      if (isDocumentVisible()) void load();
    };
    load();
    const timer = window.setInterval(load, 30000);
    const offSubsystemsRefresh = onAppEvent("subsystems-refresh", load);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", refreshWhenVisible);
    }
    return () => {
      stopped = true;
      offSubsystemsRefresh();
      window.clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", refreshWhenVisible);
      }
    };
  }, [api]);

  return subsystems;
}
