import { useEffect, useState } from "react";
import { isAbortLikeError } from "../../api/client";
import type { ApiFetch, GraphStats } from "../../types";
import { onAppEvent } from "../lib/appEvents";

export function useGraphStats(api: ApiFetch | null) {
  const [stats, setStats] = useState<GraphStats>({ candidate: 0, skill: 0, project: 0, experience: 0, joblead: 0, loaded: false, loading: false });
  useEffect(() => {
    if (!api) {
      setStats({ candidate: 0, skill: 0, project: 0, experience: 0, joblead: 0, loaded: false, loading: false });
      return;
    }
    const controller = new AbortController();
    let alive = true;
    const load = async (repair = false) => {
      setStats(prev => ({ ...prev, loading: true, request_error: "" }));
      try {
        const response = await api(`/api/v1/graph${repair ? "?repair=true" : ""}`, { signal: controller.signal, timeoutMs: repair ? 45000 : undefined });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(`Graph request failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`);
        }
        const data = await response.json();
        if (!alive) return;
        setStats({ ...data, loaded: true, loading: false, request_error: "" });
      } catch (error) {
        if (!alive || controller.signal.aborted || isAbortLikeError(error)) return;
        const message = error instanceof Error ? error.message : "Graph request failed";
        setStats(prev => ({ ...prev, loaded: true, loading: false, request_error: message }));
      }
    };
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      // Coalesce bursts — a scan broadcasts one lead-updated per scored lead, and
      // each refetch hits the expensive /api/v1/graph snapshot. Debounce so the
      // graph is fetched once after the burst settles instead of N times.
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { debounceTimer = null; load(false); }, 800);
    };
    load();
    const offEvents = [
      onAppEvent("lead-updated", refresh),
      onAppEvent("leads-refresh", refresh),
      onAppEvent("graph-refresh", refresh),
      onAppEvent("profile-refresh", refresh),
      onAppEvent("scan-done", refresh),
      onAppEvent("reevaluate-done", refresh),
      onAppEvent("cleanup-done", refresh),
    ];
    return () => {
      alive = false;
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      controller.abort();
      offEvents.forEach(off => off());
    };
  }, [api]);
  return stats;
}
