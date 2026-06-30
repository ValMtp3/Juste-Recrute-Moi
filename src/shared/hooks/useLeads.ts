import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isAbortLikeError } from "../../api/client";
import { parseLead, parseLeadsResponse } from "../../api/validation";
import type { ApiFetch, Lead, LogLine } from "../../types";
import { onAppEvent } from "../lib/appEvents";
import { readJsonResponse, responseErrorMessage } from "../lib/httpError";

function readableLeadsError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return "Les offres n'ont pas pu être chargées.";
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("backend local")) {
    return "Backend local injoignable. Vérifiez que l'app est bien démarrée, puis réessayez.";
  }
  if (lower.includes("chargement des offres")) {
    return "Les offres n'ont pas pu être chargées. Vérifiez Activité, puis réessayez.";
  }
  return trimmed;
}

function readableEventsError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return "L'historique d'activité n'a pas pu être chargé.";
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("backend local")) {
    return "Historique d'activité indisponible : backend local injoignable.";
  }
  if (lower.includes("historique") || lower.includes("activité") || lower.includes("events")) {
    return "L'historique d'activité n'a pas pu être chargé. Les offres restent utilisables.";
  }
  return trimmed;
}

function readableLeadNotificationError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return "Notification d'offre prioritaire indisponible.";
  const lower = trimmed.toLowerCase();
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("notification")) {
    return "Notification d'offre prioritaire indisponible. Vérifiez l'autorisation de notifications dans les paramètres système.";
  }
  return trimmed;
}

export function useLeads(api: ApiFetch | null, addLog?: (msg: string, kind: LogLine["kind"], src?: string) => void) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);
  const knownLeadIds = useRef<Set<string>>(new Set());

  const notifyStrongLead = useCallback((lead: Lead) => {
    const topScore = Math.max(lead.score || 0, lead.signal_score ?? 0);
    if (topScore < 80) return;
    invoke("notify_high_score_lead", {
      title: `Offre prioritaire : ${lead.title}`,
      body: `${lead.company} · Score ${topScore}`,
    }).catch(error => {
      addLog?.(readableLeadNotificationError(error), "system", "notifications");
    });
  }, [addLog]);

  useEffect(() => {
    if (!api) {
      setLoading(true);
      setLoaded(false);
      setError(null);
      initialLoadDone.current = false;
      return;
    }
    let alive = true;
    const controller = new AbortController();
    // Stamp every snapshot fetch; WS lead updates bump the stamp too, so a
    // fetch that resolves with a pre-update snapshot is discarded instead of
    // reverting fresher WS-driven state. A discarded snapshot schedules one
    // trailing reload so the list still converges after an update burst.
    let snapshotSeq = 0;
    let trailingReload: number | null = null;
    const load = async (background = false) => {
      const seq = ++snapshotSeq;
      if (!background) setLoading(true);
      try {
        const r = await api(`/api/v1/leads`, { signal: controller.signal });
        if (!r.ok) {
          throw new Error(await responseErrorMessage(r, `Chargement des offres échoué (${r.status})`));
        }
        const data = await readJsonResponse(
          r,
          "Les offres ont répondu dans un format illisible. Vérifiez Activité, puis réessayez.",
        );
        if (!alive) return;
        if (seq !== snapshotSeq) {
          if (trailingReload !== null) window.clearTimeout(trailingReload);
          trailingReload = window.setTimeout(() => load(true), 500);
          return;
        }
        const jobLeads = parseLeadsResponse(data).filter(l => (l.kind || "job") !== "freelance");
        setLeads(jobLeads);
        jobLeads.forEach(lead => knownLeadIds.current.add(lead.job_id));
        if (!background) initialLoadDone.current = true;
        setError(null);
      } catch (e) {
        if (!alive) return;
        if (controller.signal.aborted || isAbortLikeError(e)) return;
        setError(readableLeadsError(e));
      } finally {
        if (alive) {
          setLoading(false);
          setLoaded(true);
        }
      }
    };
    load(false);
    const retryTimer = window.setTimeout(() => {
      if (!initialLoadDone.current) load(true);
    }, 900);

    // Keep leads fresh when backend broadcasts LEAD_UPDATED over WS
    const offLeadUpdated = onAppEvent("lead-updated", detail => {
      const updated = parseLead(detail);
      if (!updated) return;
      const hasRenderableTitle = typeof detail.title === "string" && detail.title.trim().length > 0;
      snapshotSeq++;
      setLoaded(true);
      setLoading(false);
      setLeads(prev => {
        const idx = prev.findIndex(l => l.job_id === updated.job_id);
        if (idx === -1) {
          // Some producers dispatch partial payloads ({job_id, status});
          // inserting one as a full lead renders an "Untitled role" ghost row.
          if (!hasRenderableTitle) return prev;
          const isNew = !knownLeadIds.current.has(updated.job_id);
          knownLeadIds.current.add(updated.job_id);
          if (initialLoadDone.current && isNew) notifyStrongLead(updated);
          return [updated, ...prev];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], ...updated };
        return next;
      });
    });
    const onRefresh = () => load(true);
    const offLeadsRefresh = onAppEvent("leads-refresh", onRefresh);

    api(`/api/v1/events?limit=200`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(await responseErrorMessage(r, `Historique d'activité indisponible (${r.status})`));
        const data = await readJsonResponse(
          r,
          "L'historique d'activité a répondu dans un format illisible.",
        );
        if (!Array.isArray(data)) throw new Error("Historique d'activité invalide");
        return data as {job_id: string; action: string; ts: string}[];
      })
      .then(evts => {
        if (!alive) return;
        evts.forEach(ev => {
          const isSystem = !ev.job_id || ev.job_id === "__system__";
          const src = isSystem ? "system" : ev.job_id.slice(0, 8);
          addLog?.(`[${src}] ${ev.action}`, isSystem ? "system" : "agent", src);
        });
      })
      .catch(error => {
        if (!alive) return;
        if (controller.signal.aborted || isAbortLikeError(error)) return;
        addLog?.(readableEventsError(error), "system", "events");
      });
    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(retryTimer);
      if (trailingReload !== null) window.clearTimeout(trailingReload);
      offLeadUpdated();
      offLeadsRefresh();
    };
  }, [api, addLog, notifyStrongLead]);
  return { leads, setLeads, loading: loading && !loaded, error };
}
