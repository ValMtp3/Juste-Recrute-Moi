import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import type { ApiFetch } from "../../types";
import { emitAppEvent } from "../lib/appEvents";
import { readJsonResponse, responseErrorMessage } from "../lib/httpError";

type RuntimeProgress = {
  status?: string;
  message?: string;
  percent?: number;
  downloaded?: number;
  total?: number;
  error?: string;
  active?: boolean;
  started_at?: number | null;
  updated_at?: number | null;
};

type RuntimePayload = {
  ready?: boolean;
  required?: boolean;
  restart_required?: boolean;
  runtime?: {
    status?: string;
    ready?: boolean;
    asset?: string;
    dir?: string;
    url?: string;
    restart_required?: boolean;
  };
  vector?: {
    status?: string;
    error?: string;
    restart_required?: boolean;
  };
  progress?: RuntimeProgress;
  sync?: {
    status?: string;
    synced?: number;
    error?: string;
  };
  install_error?: string;
};

type PromptState = "checking" | "waiting" | "required" | "installing" | "restart_required" | "restarting" | "ready" | "error";

const ACTIVE_PROGRESS = new Set(["starting", "downloading", "extracting", "copying", "verifying", "syncing"]);
const RUNTIME_STATUS_TIMEOUT_MS = 90000;
const RUNTIME_INSTALL_START_TIMEOUT_MS = 0;

function isActiveProgress(progress?: RuntimeProgress) {
  return Boolean(progress?.active || (progress?.status && ACTIVE_PROGRESS.has(progress.status)));
}

function runtimeNeedsRestart(payload: RuntimePayload | null) {
  return Boolean(
    payload?.restart_required ||
    payload?.runtime?.restart_required ||
    payload?.vector?.restart_required,
  );
}

function isBackendConnectivityError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("local backend timed out") ||
    normalized.includes("local backend is unreachable") ||
    normalized.includes("backend local") ||
    normalized.includes("failed to fetch");
}

function runtimeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

function readableRuntimeError(error: unknown) {
  const trimmed = runtimeErrorMessage(error).trim();
  if (!trimmed) return "Le pack runtime n'a pas pu être vérifié. Réessayez dans un instant.";
  const normalized = trimmed.toLowerCase();
  if (isBackendConnectivityError(trimmed)) {
    return "Le backend local démarre encore.";
  }
  if (normalized.includes("runtime check failed with http")) {
    return "Le backend local n'a pas pu vérifier le pack runtime. Réessayez dans un instant.";
  }
  if (normalized.includes("runtime install failed with http 404") || (normalized.includes("404") && normalized.includes("runtime"))) {
    return "Le fichier du pack runtime est introuvable pour cette version. Installez la dernière release ou réessayez après la mise à jour.";
  }
  if (normalized.includes("runtime install failed")) {
    return "L'installation du pack runtime a échoué. Vérifiez votre connexion, puis relancez l'installation.";
  }
  if (normalized.includes("lancedb") && normalized.includes("pas installé")) {
    return "Le runtime vectoriel LanceDB n'est pas encore installé.";
  }
  if (normalized.includes("permission denied") || normalized.includes("eacces")) {
    return "L'application n'a pas les droits d'écriture pour installer le pack runtime. Déplacez-la dans Applications ou relancez avec les droits nécessaires.";
  }
  if (normalized.includes("no space") || normalized.includes("enospc")) {
    return "Espace disque insuffisant pour installer le pack runtime.";
  }
  return trimmed;
}

function runtimeCheckHttpError(status: number) {
  if (status === 404) return "La route de vérification du pack runtime est introuvable. Vérifiez que l'application desktop est bien à jour.";
  return "Le backend local n'a pas pu vérifier le pack runtime. Réessayez dans un instant.";
}

function runtimeInstallHttpError(status: number) {
  if (status === 404) return "Le fichier du pack runtime est introuvable pour cette version. Installez la dernière release ou réessayez après la mise à jour.";
  if (status === 409) return "Une installation du pack runtime est déjà en cours.";
  return "Le backend local n'a pas accepté l'installation du pack runtime. Réessayez dans un instant.";
}

async function parseRuntimePayload(response: Response) {
  const payload = await readJsonResponse<unknown>(
    response,
    "Réponse du runtime illisible. Relancez Juste Recrute Moi puis réessayez.",
  );
  return payload && typeof payload === "object" ? payload as RuntimePayload : {};
}

function bannerMessage(state: PromptState, payload: RuntimePayload | null, error: string) {
  if (state === "waiting") {
    return error
      ? `${readableRuntimeError(error)} Nouvelle tentative automatique.`
      : "Attente du démarrage du backend local.";
  }
  if (state === "installing") {
    const progress = payload?.progress;
    if (!progress) return "Installation du pack runtime...";
    const message = progress.message || "Installation du pack runtime...";
    const percent = Number.isFinite(progress.percent) ? Math.min(100, Math.max(0, Math.round(progress.percent || 0))) : null;
    if (percent !== null && percent > 0) return `${message} ${percent}%`;
    return message;
  }
  if (state === "restart_required") {
    return error ? readableRuntimeError(error) : payload?.vector?.error ? readableRuntimeError(payload.vector.error) : "Pack runtime installé. Redémarrez l'application pour terminer le chargement.";
  }
  if (state === "restarting") {
    return "Réouverture de Juste Recrute Moi...";
  }
  if (error) return readableRuntimeError(error);
  return "Le pack runtime est nécessaire pour activer le matching sémantique.";
}

export function SemanticRuntimePrompt({ api }: { api: ApiFetch }) {
  const [state, setState] = useState<PromptState>("checking");
  const [payload, setPayload] = useState<RuntimePayload | null>(null);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const stateRef = useRef<PromptState>("checking");
  const installInFlightRef = useRef(false);
  const readyDispatchedRef = useRef(false);
  const statusRequestRef = useRef(0);
  const consecutiveStatusFailuresRef = useRef(0);

  const updateState = useCallback((next: PromptState) => {
    stateRef.current = next;
    setState(next);
    // Un-dismiss when something important happens
    if (next === "restart_required" || next === "error") {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const markReady = useCallback(() => {
    updateState("ready");
    if (readyDispatchedRef.current) return;
    readyDispatchedRef.current = true;
      emitAppEvent("subsystems-refresh");
      emitAppEvent("graph-refresh");
  }, [updateState]);

  const applyPayload = useCallback((next: RuntimePayload) => {
    consecutiveStatusFailuresRef.current = 0;
    setPayload(next);
    setError("");

    if (next.ready) {
      markReady();
      return;
    }
    if (isActiveProgress(next.progress)) {
      updateState("installing");
      return;
    }
    if (runtimeNeedsRestart(next)) {
      updateState("restart_required");
      return;
    }
    if (next.required === false || next.runtime?.ready) {
      markReady();
      return;
    }
    if (next.progress?.status === "error") {
      setError(readableRuntimeError(next.progress.error || next.progress.message || next.install_error || "Runtime install failed."));
      updateState("error");
      return;
    }
    updateState("required");
  }, [markReady, updateState]);

  const loadStatus = useCallback(async () => {
    const requestId = statusRequestRef.current + 1;
    statusRequestRef.current = requestId;
    try {
      const response = await api("/api/v1/runtime/vector", { timeoutMs: RUNTIME_STATUS_TIMEOUT_MS });
      if (!response.ok) throw new Error(await responseErrorMessage(response, runtimeCheckHttpError(response.status)));
      const next = await parseRuntimePayload(response);
      if (requestId !== statusRequestRef.current) return;
      applyPayload(next);
    } catch (err) {
      if (requestId !== statusRequestRef.current) return;
      const message = runtimeErrorMessage(err);
      consecutiveStatusFailuresRef.current += 1;
      setError(readableRuntimeError(err));
      if (stateRef.current === "installing" && consecutiveStatusFailuresRef.current < 4) {
        return;
      }
      updateState(isBackendConnectivityError(message) ? "waiting" : "error");
    }
  }, [api, applyPayload, updateState]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const tick = async () => {
      await loadStatus();
      if (cancelled) return;
      const current = stateRef.current;
      const delay = current === "installing" ? 1000 : current === "waiting" || current === "checking" ? 2500 : 30000;
      timer = window.setTimeout(tick, delay);
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadStatus]);

  const install = async () => {
    if (installInFlightRef.current || stateRef.current === "installing") return;
    installInFlightRef.current = true;
    statusRequestRef.current += 1;
    updateState("installing");
    setError("");
    setDismissed(false);
    try {
      const response = await api("/api/v1/runtime/vector/install", { method: "POST", timeoutMs: RUNTIME_INSTALL_START_TIMEOUT_MS });
      if (!response.ok) throw new Error(await responseErrorMessage(response, runtimeInstallHttpError(response.status)));
      const next = await parseRuntimePayload(response);
      applyPayload(next);
      window.setTimeout(() => {
        void loadStatus();
      }, 600);
    } catch (err) {
      const message = runtimeErrorMessage(err);
      setError(readableRuntimeError(err));
      updateState(isBackendConnectivityError(message) ? "waiting" : "error");
    } finally {
      installInFlightRef.current = false;
    }
  };

  const restartApp = async () => {
    updateState("restarting");
    setError("");
    try {
      await relaunch();
    } catch (err) {
      setError(readableRuntimeError(err));
      updateState("restart_required");
    }
  };

  const message = useMemo(() => bannerMessage(state, payload, error), [state, payload, error]);
  const progress = payload?.progress;
  const progressPercent = Number.isFinite(progress?.percent) ? Math.min(100, Math.max(0, Math.round(progress?.percent || 0))) : null;
  const needsRestart = runtimeNeedsRestart(payload);
  const isBusy = state === "checking" || state === "waiting" || state === "installing" || state === "restarting";
  const canInstall = !needsRestart && (state === "required" || (state === "error" && Boolean(payload) && payload?.required !== false));

  // Don't render when ready, dismissed, or still checking
  if (state === "ready") return null;
  if (dismissed && state !== "restart_required" && state !== "error") return null;
  if (state === "checking") return null;

  return (
    <div className="semantic-runtime-banner" role="status" aria-live="polite">
      <div className="semantic-runtime-banner-content">
        <div className="semantic-runtime-banner-icon" aria-hidden="true">S</div>
        <div className="semantic-runtime-banner-text">
          <span className={state === "error" ? "update-error" : undefined}>{message}</span>
        </div>
        {isBusy && state === "installing" && (
          <div className={`semantic-runtime-banner-progress ${progressPercent === null ? "is-indeterminate" : ""}`}>
            <div style={progressPercent !== null ? { width: `${progressPercent}%` } : undefined} />
          </div>
        )}
        <div className="semantic-runtime-banner-actions">
          {needsRestart && (
            <button className="btn btn-accent btn-sm" onClick={() => void restartApp()} disabled={state === "restarting"}>
              {state === "restarting" ? "Redémarrage..." : "Redémarrer"}
            </button>
          )}
          {canInstall && (
            <button className="btn btn-accent btn-sm" onClick={install} disabled={isBusy}>
              Installer
            </button>
          )}
          {(state === "waiting" || state === "error") && (
            <button className="btn btn-ghost btn-sm" onClick={() => void loadStatus()}>
              Réessayer
            </button>
          )}
          {!needsRestart && state !== "error" && (
            <button
              className="btn btn-ghost btn-sm semantic-runtime-dismiss"
              onClick={() => setDismissed(true)}
              aria-label="Masquer"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
