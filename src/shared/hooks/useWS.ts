import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { ConnSt, Lead, LogLine, OperationProgress } from "../../types";
import type { WSMessage } from "../../api/types";
import { emitAppEvent } from "../lib/appEvents";
import { readJsonResponse } from "../lib/httpError";

const READY_RETRY_MS = 180;
const READY_ATTEMPTS = 60;
const SIDECAR_STARTUP_DIAGNOSTIC_POLLS = 8;

const delay = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
const hasTauriEventBridge = () => (
  typeof (window as Window & { __TAURI_INTERNALS__?: { transformCallback?: unknown } }).__TAURI_INTERNALS__?.transformCallback === "function"
);

const emptyProgress = (): OperationProgress => ({
  active: false,
  mode: null,
  total: 0,
  completed: 0,
  current: "",
  updatedAt: Date.now(),
});

type BackendStatus = { scanning?: boolean; reevaluating?: boolean };

function firstNumber(value: string | undefined) {
  const match = String(value || "").match(/\b(\d+)\b/);
  return match ? Number(match[1]) : 0;
}

function prevTotalFromMessage(value: string | undefined) {
  const match = String(value || "").match(/\[(\d+)\/(\d+)\]/);
  return match ? Number(match[2]) : 0;
}

function readableWsError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
    return "Backend local injoignable. Nouvelle tentative automatique.";
  }
  if (lower.includes("syntaxerror") || lower.includes("json")) {
    return "Message temps réel ignoré : format inattendu.";
  }
  if (lower.includes("http 401") || lower.includes("http 403")) {
    return "Synchronisation backend refusée. Le jeton local a peut-être changé.";
  }
  if (lower.startsWith("http ")) {
    return "Statut backend indisponible. Nouvelle tentative automatique.";
  }
  return trimmed;
}

function sidecarStartupMessage(hasToken: boolean, hasPort: boolean) {
  const missing = [
    hasPort ? "" : "port backend",
    hasToken ? "" : "jeton API local",
  ].filter(Boolean).join(" et ");
  return missing
    ? `Backend local en démarrage : ${missing} non reçu. Nouvelle tentative automatique.`
    : "Backend local en démarrage. Nouvelle tentative automatique.";
}

export function nextProgressFromAgentEvent(
  previous: OperationProgress,
  event: string | undefined,
  message: string | undefined,
  now = Date.now(),
): OperationProgress {
  if (event === "eval_start") {
    return { active: true, mode: "scan", total: firstNumber(message), completed: 0, current: "", updatedAt: now };
  }
  if (event === "scan_progress") {
    // The backend sends current, total and target directly in the event, but we don't have access to the raw payload here.
    // However, the message contains: "Exploration de {target} ({current}/{total})..."
    // We can parse it or change the method signature, but since the frontend expects `message`, we'll parse it like `reeval_scored`.
    const match = String(message || "").match(/\((\d+)\/(\d+)\)/);
    const completed = match ? Number(match[1]) : previous.completed;
    const total = match ? Number(match[2]) : previous.total;
    return { active: true, mode: "scan", total, completed, current: message ?? "", updatedAt: now };
  }
  if (event === "eval_scored") {
    return { active: true, mode: "scan", total: previous.total, completed: previous.completed + 1, current: message ?? "", updatedAt: now };
  }
  if (event === "reeval_start") {
    return { active: true, mode: "reevaluate", total: firstNumber(message), completed: 0, current: "", updatedAt: now };
  }
  if (event === "reeval_scored") {
    return {
      active: true,
      mode: "reevaluate",
      total: previous.total || prevTotalFromMessage(message),
      completed: previous.completed + 1,
      current: message ?? "",
      updatedAt: now,
    };
  }
  if (event === "eval_done" || event === "reeval_done" || event === "cleanup_done") {
    return { active: false, mode: null, total: 0, completed: 0, current: "", updatedAt: now };
  }
  return previous;
}

export const __wsTest = { emptyProgress, firstNumber, prevTotalFromMessage, readableWsError, sidecarStartupMessage };

async function fetchBackendStatus(port: number, token: string): Promise<BackendStatus> {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/status`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await readJsonResponse<BackendStatus>(
    response,
    "Statut backend illisible. Nouvelle tentative automatique.",
  );
}

async function waitForBackendReady(port: number, isCurrent: () => boolean) {
  for (let attempt = 0; attempt < READY_ATTEMPTS; attempt += 1) {
    if (!isCurrent()) return false;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: "no-store" });
      if (response.ok) return true;
    } catch {
      // The sidecar prints its port before uvicorn starts accepting connections.
    }
    await delay(READY_RETRY_MS);
  }
  return false;
}

export function useWS() {
  const [conn, setConn] = useState<ConnSt>("disconnected");
  const [port, setPort] = useState<number | null>(null);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [sidecarError, setSidecarError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [beat, setBeat] = useState(0);
  const [progress, setProgress] = useState<OperationProgress>(() => emptyProgress());
  const wsRef = useRef<WebSocket | null>(null);
  const wsEndpointRef = useRef("");
  const idRef = useRef(0);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const readinessSeqRef = useRef(0);
  const manuallyClosedRef = useRef(false);
  // Set when the reconnect budget is exhausted, so the sidecar poll knows to
  // resume probing instead of staying stuck on "Backend unreachable" forever.
  const forceResyncRef = useRef(false);
  const MAX_RETRY_DELAY = 30000;
  const MAX_RETRIES = 20;

  const addLog = useCallback((msg: string, kind: LogLine["kind"], src = "sys") => {
    setLogs(p => [
      { id: idRef.current++, ts: String(idRef.current).padStart(4, "0"), msg, src, kind },
      ...p.slice(0, 149),
    ]);
  }, []);

  const connect = useCallback((p: number, token: string) => {
    const endpoint = `${p}:${token}`;
    const current = wsRef.current;
    if (current && wsEndpointRef.current === endpoint && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) return;
    if (current) {
      current.onclose = null;
      current.close();
    }
    // L4: cancel any pending reconnect timer before (re)connecting so a stale
    // backoff callback can't fire a duplicate connection later.
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    manuallyClosedRef.current = false;
    setConn("connecting");
    // Auth token rides in the Sec-WebSocket-Protocol header (2nd subprotocol),
    // not the URL, so it never lands in logs/history. Server echoes "jhm.bearer".
    const ws = new WebSocket(`ws://127.0.0.1:${p}/ws`, ["jhm.bearer", token]);
    wsRef.current = ws;
    wsEndpointRef.current = endpoint;
    const reconcileBackendStatus = () => {
      fetchBackendStatus(p, token)
        .then(status => {
          if (!status?.scanning && !status?.reevaluating) setProgress(emptyProgress());
          emitAppEvent("backend-status", status);
        })
        .catch(error => {
          addLog(`Échec de synchronisation du statut : ${readableWsError(error, "Statut backend indisponible.")}`, "system", "ws");
        });
    };
    ws.onopen    = () => {
      if (wsRef.current !== ws) return;
      const wasReconnect = retryRef.current > 0;
      setConn("connected");
      retryRef.current = 0;
      addLog("WebSocket connecté", "system", "ws");
      if (wasReconnect) reconcileBackendStatus();
    };
    ws.onmessage = (e) => {
      if (wsRef.current !== ws) return;
      try {
        const d = JSON.parse(e.data) as WSMessage;
        if (d.type === "heartbeat") {
          setBeat(d.beat);
          if (d.beat % 10 === 1)
            addLog(`Heartbeat #${d.beat} - uptime ${d.uptime_seconds.toFixed(0)}s`, "heartbeat", "hb");
        } else if (d.type === "agent") {
          addLog(d.msg ?? d.event ?? "agent", "agent", d.event ?? "agent");
          if (d.event === "eval_start" || d.event === "eval_scored") {
            setProgress(prev => nextProgressFromAgentEvent(prev, d.event, d.msg));
          }
          if (d.event === "eval_done") {
            setProgress(prev => nextProgressFromAgentEvent(prev, d.event, d.msg));
            emitAppEvent("scan-done");
          }
          if (d.event === "reeval_start" || d.event === "reeval_scored") {
            setProgress(prev => nextProgressFromAgentEvent(prev, d.event, d.msg));
          }
          if (d.event === "reeval_done") {
            setProgress(prev => nextProgressFromAgentEvent(prev, d.event, d.msg));
            emitAppEvent("reevaluate-done");
            emitAppEvent("leads-refresh");
          }
          if (d.event === "cleanup_done") {
            setProgress(prev => nextProgressFromAgentEvent(prev, d.event, d.msg));
            emitAppEvent("cleanup-done");
            emitAppEvent("leads-refresh");
          }
          if (d.event === "auto_discard_done") emitAppEvent("leads-refresh");
        } else if (d.type === "LEAD_UPDATED" && d.data) {
          emitAppEvent("lead-updated", d.data as Lead);
        } else if (d.type === "HOT_X_LEAD" && d.data) {
          emitAppEvent("hot-x-lead", d.data);
          if ("Notification" in window && Notification.permission === "granted") {
            const lead = d.data as Lead;
            new Notification("Offre prioritaire", { body: `${lead.company}: ${lead.title}` });
          }
        }
      } catch (err) {
        const preview = typeof e.data === "string" ? e.data.slice(0, 200) : "";
        console.warn("[WS] Message impossible à analyser :", err, preview);
        addLog(readableWsError(err, "Message temps réel ignoré : format inattendu."), "system", "ws");
      }
    };
    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setConn("disconnected");
      wsRef.current = null;
      wsEndpointRef.current = "";
      if (manuallyClosedRef.current) return;
      if (retryRef.current >= MAX_RETRIES) {
        setSidecarError("Backend injoignable. Relance Juste Recrute Moi ou vérifie le processus backend.");
        setPort(null);
        setApiToken(null);
        addLog("Backend injoignable après plusieurs tentatives de reconnexion WebSocket", "system", "ws");
        // Re-arm so the sidecar poll resumes probing; if the backend recovers
        // (or relaunches on a new port) we reconnect instead of staying dead
        // until the app is restarted.
        retryRef.current = 0;
        forceResyncRef.current = true;
        return;
      }
      const delay = Math.min(1000 * Math.pow(2, retryRef.current), MAX_RETRY_DELAY);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      retryRef.current += 1;
      retryTimerRef.current = window.setTimeout(() => connect(p, token), jitter);
    };
    ws.onerror = () => ws.close();
  }, [addLog]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    let poll: number | undefined;
    (async () => {
      let token: string | null = null;
      let currentPort: number | null = null;
      let backendReady = false;
      let pendingEndpoint = "";
      let publishedEndpoint = "";
      let sidecarProbeFailures = 0;
      const publishReadyBackend = async (p: number, t: string) => {
        const endpoint = `${p}:${t}`;
        if (backendReady && publishedEndpoint === endpoint) return;
        if (pendingEndpoint === endpoint) return;
        pendingEndpoint = endpoint;
        const seq = ++readinessSeqRef.current;
        setConn("connecting");
        const ready = await waitForBackendReady(p, () => !cancelled && readinessSeqRef.current === seq);
        if (pendingEndpoint === endpoint) pendingEndpoint = "";
        if (!ready || cancelled || readinessSeqRef.current !== seq) {
          if (!cancelled && readinessSeqRef.current === seq) {
            backendReady = false;
            setPort(null);
            setApiToken(null);
            setSidecarError(`Le backend n'est pas prêt sur le port ${p}.`);
          }
          return;
        }
        backendReady = true;
        publishedEndpoint = endpoint;
        setSidecarError(null);
        setApiToken(t);
        setPort(p);
        connect(p, t);
      };
      const maybePublish = () => {
        if (token && currentPort && publishedEndpoint !== `${currentPort}:${token}`) {
          backendReady = false;
        }
        if (token && currentPort) void publishReadyBackend(currentPort, token);
      };
      const syncSidecar = async () => {
        let reportedSidecarError = "";
        try {
          const err = await invoke<string>("get_sidecar_error");
          reportedSidecarError = err || "";
          setSidecarError(reportedSidecarError || null);
        } catch { /* no sidecar error */ }
        let hasToken = Boolean(token);
        try {
          token = await invoke<string>("get_api_token");
          hasToken = true;
        } catch { /* not ready */ }
        let hasPort = Boolean(currentPort);
        try {
          const p = await invoke<number>("get_sidecar_port");
          currentPort = p;
          hasPort = Boolean(p);
        } catch { /* not ready */ }
        if (hasToken && hasPort) {
          sidecarProbeFailures = 0;
        } else {
          sidecarProbeFailures += 1;
          if (sidecarProbeFailures >= SIDECAR_STARTUP_DIAGNOSTIC_POLLS && !reportedSidecarError) {
            setSidecarError(sidecarStartupMessage(hasToken, hasPort));
          }
        }
        maybePublish();
      };
      await syncSidecar();
      poll = window.setInterval(() => {
        if (cancelled) return;
        if (forceResyncRef.current) {
          // Reconnect budget was exhausted; clear the cached readiness so
          // maybePublish() re-publishes and reconnects when the backend returns.
          forceResyncRef.current = false;
          backendReady = false;
          publishedEndpoint = "";
        }
        if (!token || !currentPort || !backendReady) void syncSidecar();
      }, 1000);
      if (!hasTauriEventBridge()) {
        addLog("Bridge d'événements desktop indisponible ; le polling reste actif.", "system", "sidecar");
        return;
      }
      try {
        unlisten = await listen<number>("sidecar-port", ev => {
          currentPort = ev.payload;
          maybePublish();
        });
        const unlistenToken = await listen<string>("sidecar-token", ev => {
          token = ev.payload;
          maybePublish();
        });
        const unlistenError = await listen<string>("sidecar-error", ev => {
          setSidecarError(ev.payload);
          addLog(ev.payload, "system", "sidecar");
        });
        const unlistenTerminated = await listen("sidecar-terminated", () => {
          readinessSeqRef.current += 1;
          currentPort = null;
          token = null;
          backendReady = false;
          pendingEndpoint = "";
          publishedEndpoint = "";
          setPort(null);
          setApiToken(null);
          setConn("disconnected");
          setProgress(emptyProgress());
          emitAppEvent("backend-status", { scanning: false, reevaluating: false });
          addLog("Sidecar backend arrêté", "system", "sidecar");
        });
        const prevUnlisten = unlisten;
        unlisten = () => { prevUnlisten?.(); unlistenToken(); unlistenError(); unlistenTerminated(); };
      } catch (error) {
        addLog(`Bridge d'événements desktop indisponible ; polling actif. ${readableWsError(error, "Le polling reste actif.")}`, "system", "sidecar");
      }
    })();
    return () => {
      cancelled = true;
      readinessSeqRef.current += 1;
      if (poll !== undefined) window.clearInterval(poll);
      unlisten?.();
      manuallyClosedRef.current = true;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (wsRef.current) wsRef.current.onclose = null;
      wsRef.current?.close();
    };
  }, [addLog, connect]);

  return { conn, port, apiToken, sidecarError, logs, beat, addLog, progress };
}
