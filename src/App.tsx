import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import SettingsModal from "./features/settings/SettingsModal";
import "./index.css";
import type { ApiFetch, PipelineTab, View } from "./types";
import { createApiFetch } from "./api/client";
import { useAppShellState } from "./shared/context/AppContext";
import { ONBOARDING_KEY } from "./shared/lib/leadUtils";
import { useWS } from "./shared/hooks/useWS";
import { useLeads } from "./shared/hooks/useLeads";
import { useDueFollowups } from "./shared/hooks/useDueFollowups";
import { useGraphStats } from "./shared/hooks/useGraphStats";
import { useKeyboardShortcuts } from "./shared/hooks/useKeyboardShortcuts";
import { useSubsystemHealth, type SubsystemHealth } from "./shared/hooks/useSubsystemHealth";
import { Sidebar } from "./shared/components/Sidebar";
import { Topbar } from "./shared/components/Topbar";
import ErrorBoundary from "./shared/components/ErrorBoundary";
import { DashboardView } from "./features/dashboard/DashboardView";
import { ApplyJobView } from "./features/apply/ApplyJobView";
import { PipelineView } from "./features/pipeline/PipelineView";
import { GraphView } from "./features/graph/GraphView";
import { ActivityView } from "./features/activity/ActivityView";
import { ProfileView } from "./features/profile/ProfileView";
import { IngestionView } from "./features/profile/IngestionView";
import { ApprovalDrawer } from "./features/pipeline/components/ApprovalDrawer";
import { OnboardingWizard } from "./shared/components/OnboardingWizard";
import { HelpChat } from "./shared/components/HelpChat";
import { UpdatePrompt } from "./shared/components/UpdatePrompt";
import { SemanticRuntimePrompt } from "./shared/components/SemanticRuntimePrompt";
import { CreatorFooter } from "./shared/components/CreatorFooter";
import { emitAppEvent, onAppEvent } from "./shared/lib/appEvents";
import { copyTextToClipboard } from "./shared/lib/clipboard";
import { readJsonResponse, responseErrorMessage } from "./shared/lib/httpError";
import { readLocalStorage, writeLocalStorage } from "./shared/lib/storage";

const PIPELINE_VIEW_TO_TAB: Partial<Record<View, PipelineTab>> = {
  pipeline: "all",
  "pipeline-hot": "hot",
  "pipeline-found": "found",
  "pipeline-evaluated": "evaluated",
  "pipeline-generated": "generated",
  "pipeline-applied": "applied",
  "pipeline-discarded": "discarded",
};

const connLabel = (conn: string) => ({
  connected: "connecté",
  connecting: "connexion",
  disconnected: "déconnecté",
}[conn] || conn);

function hasDesktopBridge() {
  return typeof (window as Window & { __TAURI_INTERNALS__?: { transformCallback?: unknown } }).__TAURI_INTERNALS__?.transformCallback === "function";
}

function isActionableSubsystemIssue(name: string, value: SubsystemHealth[string]) {
  if (value.status === "ok") return false;
  const message = String(value.error || value.reason || "").toLowerCase();
  if (name === "llm" && message.includes("api key")) return false;
  if (name === "embeddings" && value.mode === "hashing") return false;
  return true;
}

function readableAppError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("backend injoignable") || lower.includes("backend local")) {
    return "Backend local injoignable. Vérifiez que l'app est bien démarrée, puis réessayez.";
  }
  if (lower.includes("arrêt")) {
    return fallback;
  }
  if (lower.includes("scan")) {
    return "Le scan n'a pas pu démarrer. Vérifiez Activité, puis réessayez.";
  }
  if (lower.includes("réévaluation") || lower.includes("reeval")) {
    return "La réévaluation n'a pas pu démarrer. Vérifiez Activité, puis réessayez.";
  }
  if (lower.includes("nettoyage")) {
    return "Le nettoyage n'a pas pu démarrer. Vérifiez Activité, puis réessayez.";
  }
  if (lower.includes("suppression")) {
    return "La suppression n'a pas pu être appliquée. Réessayez dans quelques secondes.";
  }
  return trimmed;
}

function readableStartupError(error: string | null) {
  const trimmed = String(error || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (lower.includes("port backend") || lower.includes("jeton api local") || lower.includes("jeton api")) {
    return `Le backend local démarre encore. ${trimmed}`;
  }
  if (lower.includes("permission denied") || lower.includes("operation not permitted") || lower.includes("quarantine") || lower.includes("blocked")) {
    return `macOS bloque probablement le backend intégré. Ouvrez Confidentialité et sécurité > Ouvrir quand même, puis relancez l'application.\n\nDétail : ${trimmed}`;
  }
  if (lower.includes("no such file") || lower.includes("not found") || lower.includes("introuvable")) {
    return `Le backend intégré est introuvable dans cette installation. Réinstallez la dernière version de Juste Recrute Moi, puis relancez l'application.\n\nDétail : ${trimmed}`;
  }
  if (lower.includes("address already in use") || lower.includes("port already") || lower.includes("eaddrinuse")) {
    return `Un ancien backend semble encore ouvert sur le port local. Quittez Juste Recrute Moi, attendez quelques secondes, puis relancez.\n\nDétail : ${trimmed}`;
  }
  if (lower.includes("backend injoignable") || lower.includes("failed to fetch") || lower.includes("connection refused")) {
    return `Le backend local ne répond pas encore. Relancez Juste Recrute Moi si cet écran reste bloqué.\n\nDétail : ${trimmed}`;
  }
  return `Le backend intégré n'a pas pu démarrer correctement.\n\nDétail : ${trimmed}`;
}

export default function App() {
  const { conn, port, apiToken, sidecarError, logs, addLog: wsAddLog, progress } = useWS();
  const api = useMemo<ApiFetch | null>(() => {
    if (!port || !apiToken) return null;
    return createApiFetch(port, apiToken);
  }, [port, apiToken]);
  const { leads, setLeads, loading: leadsLoading, error: leadsError } = useLeads(api, wsAddLog);
  const dueFollowups = useDueFollowups(api, wsAddLog);
  const stats  = useGraphStats(api);
  const {
    view, setView, sel, setSel, showSettings, setShowSettings, showOnboarding,
    setShowOnboarding, applyDraft, setApplyDraft, applyAutoFocus, setApplyAutoFocus,
    scanning, setScanning, reevaluating, setReevaluating, cleaning, setCleaning,
    scanErr, setScanErr, closeDrawer, focusApplyView, openSettings, openSetupGuide,
  } = useAppShellState();
  const [scanSpeed, setScanSpeed] = useState<"rapide" | "moyen" | "max">("moyen");
  // Always pass the live version of the selected lead so the drawer reflects real-time updates
  const liveSel = sel ? (leads.find(l => l.job_id === sel.job_id) ?? sel) : null;
  const [startupSeconds, setStartupSeconds] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readLocalStorage("jhm-sidebar-collapsed") === "1");
  const subsystems = useSubsystemHealth(api);

  useEffect(() => {
    writeLocalStorage("jhm-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  useEffect(() => {
    const h = () => setScanning(false);
    return onAppEvent("scan-done", h);
  }, [setScanning]);

  useEffect(() => {
    const h = (detail: { scanning?: boolean; reevaluating?: boolean } | undefined) => {
      setScanning(Boolean(detail?.scanning));
      setReevaluating(Boolean(detail?.reevaluating));
    };
    return onAppEvent("backend-status", h);
  }, [setReevaluating, setScanning]);

  useEffect(() => {
    if (!scanning) return;
    const timer = window.setTimeout(() => {
      setScanning(false);
      const msg = "Indicateur de scan réinitialisé après 15 minutes sans progression backend.";
      setScanErr(msg);
      wsAddLog(msg, "system", "scan");
    }, 15 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [scanning, progress.updatedAt, setScanning, setScanErr, wsAddLog]);

  useEffect(() => {
    if (api) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setStartupSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [api]);

  useKeyboardShortcuts({
    onEscape: closeDrawer,
    onCmdK: focusApplyView,
    onCmdComma: openSettings,
  });

  useEffect(() => {
    if (view !== "apply" || !applyAutoFocus) return;
    const timer = window.setTimeout(() => setApplyAutoFocus(false), 0);
    return () => window.clearTimeout(timer);
  }, [view, applyAutoFocus, setApplyAutoFocus]);

  useEffect(() => {
    const h = () => setReevaluating(false);
    return onAppEvent("reevaluate-done", h);
  }, [setReevaluating]);

  useEffect(() => {
    const h = () => setCleaning(false);
    return onAppEvent("cleanup-done", h);
  }, [setCleaning]);

  const onScan = useCallback(async (speed?: "rapide" | "moyen" | "max") => {
    if (!port || !api || scanning) return;
    setScanning(true); setScanErr(null);
    try {
      const selectedSpeed = speed || scanSpeed;
      let maxRequests = "20";
      if (selectedSpeed === "rapide") maxRequests = "5";
      if (selectedSpeed === "max") maxRequests = "80";
      await api(`/api/v1/settings`, {
        method: "PATCH",
        body: JSON.stringify({ free_source_max_requests: maxRequests })
      });
      const r = await api(`/api/v1/scan`, { method: "POST" });
      if (!r.ok) {
        throw new Error(await responseErrorMessage(r, "Backend injoignable"));
      }
    } catch (e: unknown) {
      setScanErr(readableAppError(e, "Le scan a échoué")); setScanning(false);
    }
  }, [port, api, scanning, scanSpeed, setScanErr, setScanning]);

  const onStopScan = useCallback(async () => {
    if (!port || !api) return;
    try {
      const r = await api(`/api/v1/scan/stop`, { method: "POST" });
      if (!r.ok) {
        throw new Error(await responseErrorMessage(r, "Arrêt du scan impossible"));
      }
    } catch (e: unknown) {
      const msg = readableAppError(e, "La demande d'arrêt du scan a échoué");
      setScanErr(msg);
      wsAddLog(msg, "system", "scan");
    }
  }, [port, api, setScanErr, wsAddLog]);

  const onReevaluateJobs = useCallback(async () => {
    if (!port || !api || reevaluating || scanning) return;
    setReevaluating(true); setScanErr(null);
    try {
      const r = await api(`/api/v1/leads/reevaluate`, { method: "POST" });
      if (!r.ok) {
        throw new Error(await responseErrorMessage(r, "La réévaluation a échoué"));
      }
    } catch (e: unknown) {
      const msg = readableAppError(e, "La réévaluation a échoué");
      setScanErr(msg); setReevaluating(false);
      wsAddLog(msg, "system", "reeval");
    }
  }, [port, api, reevaluating, scanning, setReevaluating, setScanErr, wsAddLog]);

  const onStopReevaluate = useCallback(async () => {
    if (!port || !api) return;
    try {
      const r = await api(`/api/v1/leads/reevaluate/stop`, { method: "POST" });
      if (!r.ok) {
        throw new Error(await responseErrorMessage(r, "Arrêt de la réévaluation impossible"));
      }
    } catch (e: unknown) {
      const msg = readableAppError(e, "La demande d'arrêt de la réévaluation a échoué");
      setScanErr(msg);
      wsAddLog(msg, "system", "reeval");
    }
  }, [port, api, setScanErr, wsAddLog]);

  const onCleanupLeads = useCallback(async () => {
    if (!port || !api || scanning || reevaluating || cleaning) return;
    setCleaning(true); setScanErr(null);
    try {
      const r = await api(`/api/v1/leads/cleanup`, { method: "POST" });
      if (!r.ok) {
        throw new Error(await responseErrorMessage(r, "Le nettoyage a échoué"));
      }
      const result = await readJsonResponse<Record<string, unknown>>(
        r,
        "Le nettoyage a répondu dans un format illisible. Vérifiez Activité, puis réessayez.",
      );
      wsAddLog(`Nettoyage : ${result.candidates ?? 0} lignes masquées après analyse de ${result.scanned ?? 0}`, "system", "cleanup");
      emitAppEvent("leads-refresh");
    } catch (e: unknown) {
      const msg = readableAppError(e, "Le nettoyage a échoué");
      setScanErr(msg);
      wsAddLog(msg, "system", "cleanup");
    } finally {
      setCleaning(false);
    }
  }, [port, api, scanning, reevaluating, cleaning, setCleaning, setScanErr, wsAddLog]);

  const deleteLead = useCallback(async (jobId: string) => {
    if (!port || !api) return;
    const response = await api(`/api/v1/leads/${jobId}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response, "Suppression impossible"));
    }
    setLeads(prev => prev.filter(l => l.job_id !== jobId));
  }, [port, api, setLeads]);

  const leadCounts = {
    total:        leads.length,
    hot:          leads.filter(l => (l.signal_score || 0) >= 80 || (l.score || 0) >= 85).length,
    discovered:   leads.filter(l=>l.status==="discovered").length,
    evaluated:    leads.filter(l => l.score > 0 || (l.signal_score || 0) > 0).length,
    evaluating:   leads.filter(l=>l.status==="evaluating").length,
    tailoring:    leads.filter(l=>l.status==="tailoring").length,
    approved:     leads.filter(l=>l.status==="approved").length,
    ready:        leads.filter(l=>l.status==="tailoring" || l.status==="approved").length,
    applied:      leads.filter(l=>l.status==="applied").length,
    discarded:    leads.filter(l=>l.status==="discarded").length,
    interviewing: leads.filter(l=>l.status==="interviewing").length,
    accepted:     leads.filter(l=>l.status==="accepted").length,
    rejected:     leads.filter(l=>l.status==="rejected").length,
  };
  const pipelineTab = PIPELINE_VIEW_TO_TAB[view] || "all";
  const isPipelineView = Boolean(PIPELINE_VIEW_TO_TAB[view]);
  const degradedSubsystems = Object.entries(subsystems ?? {}).filter(([name, value]) => isActionableSubsystemIssue(name, value));

  if (!api) {
    return (
      <>
        <StartupScreen conn={conn} port={port} seconds={startupSeconds} sidecarError={sidecarError} />
        <UpdatePrompt />
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", alignItems: "stretch" }}>
        <Sidebar
          view={view}
          setView={setView}
          leadCounts={leadCounts}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(value => !value)}
          onGuide={openSetupGuide}
          onSettings={() => setShowSettings(true)}
        />
        <div className="app-main">
          <Topbar view={view} progress={progress} />
          <SubsystemBanner
            items={degradedSubsystems}
            onSettings={() => setShowSettings(true)}
            onActivity={() => setView("activity")}
          />
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
            {view === "apply"     && <ErrorBoundary label="Adaptation" api={api ?? undefined}><ApplyJobView port={port} api={api} leads={leads} openDrawer={setSel} initialInput={applyDraft} autoFocus={applyAutoFocus} /></ErrorBoundary>}
            {view === "dashboard" && <ErrorBoundary label="Tableau de bord" api={api ?? undefined}><DashboardView leads={leads} dueFollowups={dueFollowups} logs={logs} setView={setView} openDrawer={setSel} scanning={scanning} reevaluating={reevaluating} cleaning={cleaning} progress={progress} onScan={onScan} scanSpeed={scanSpeed} setScanSpeed={setScanSpeed} onStopScan={onStopScan} onReevaluate={onReevaluateJobs} onStopReevaluate={onStopReevaluate} onCleanup={onCleanupLeads} scanErr={scanErr} api={api} /></ErrorBoundary>}
            {isPipelineView  && <ErrorBoundary label="Pipeline" api={api ?? undefined}><PipelineView leads={leads} openDrawer={setSel} deleteLead={deleteLead} port={port} api={api} scanning={scanning} reevaluating={reevaluating} cleaning={cleaning} progress={progress} onScan={onScan} scanSpeed={scanSpeed} setScanSpeed={setScanSpeed} onReevaluate={onReevaluateJobs} onStopReevaluate={onStopReevaluate} onCleanup={onCleanupLeads} setView={setView} loading={leadsLoading || !port || !api} error={leadsError} tab={pipelineTab} /></ErrorBoundary>}
            {view === "graph"     && <ErrorBoundary label="Graphe" api={api ?? undefined}><GraphView stats={stats} setView={setView} /></ErrorBoundary>}
            {view === "activity"  && <ErrorBoundary label="Activité" api={api ?? undefined}><ActivityView logs={logs} setView={setView} /></ErrorBoundary>}
            {view === "profile"   && (api ? <ErrorBoundary label="Profil" api={api ?? undefined}><ProfileView api={api} setView={setView} stats={stats} /></ErrorBoundary> : <BackendUnavailable title="Profil" conn={conn} port={port} />)}
            {view === "ingestion" && (api ? <ErrorBoundary label="Contexte" api={api ?? undefined}><IngestionView api={api} setView={setView} /></ErrorBoundary> : <BackendUnavailable title="Ajout de contexte" conn={conn} port={port} />)}
          </div>
        </div>

        {/* The drawer/modal layer renders the richest untyped lead data; a
            render crash here without a boundary would blank the whole app. */}
        <ErrorBoundary label="Détail offre" api={api ?? undefined}>
          <AnimatePresence>
            {liveSel && api && (
              <ApprovalDrawer key={liveSel.job_id} j={liveSel} api={api} onClose={() => setSel(null)} />
            )}
            {showSettings && api && (
              <SettingsModal key="settings" api={api} onClose={() => setShowSettings(false)} />
            )}
            {showOnboarding && api && (
              <OnboardingWizard
                key="onboarding"
                api={api}
                onOpenSettings={() => {
                  setShowOnboarding(false);
                  setShowSettings(true);
                }}
                onFinish={(draft) => {
                  writeLocalStorage(ONBOARDING_KEY, "done");
                  setApplyDraft(draft);
                  setView("apply");
                  setShowOnboarding(false);
                }}
              />
            )}
          </AnimatePresence>
        </ErrorBoundary>
        {api && (
          <ErrorBoundary label="Assistant" api={api}>
            <HelpChat api={api} />
          </ErrorBoundary>
        )}
      </div>
      <ErrorBoundary label="Invites" api={api ?? undefined}>
        <SemanticRuntimePrompt api={api} />
        <UpdatePrompt />
      </ErrorBoundary>
    </>
  );
}

function readableSubsystemName(name: string) {
  return ({
    llm: "IA",
    vector: "Vecteurs",
    embeddings: "Embeddings",
    graph: "Graphe",
    database: "Base locale",
  } as Record<string, string>)[name] || name;
}

function readableSubsystemStatus(status: string | undefined) {
  const normalized = String(status || "unknown").toLowerCase();
  return ({
    degraded: "dégradé",
    disabled: "désactivé",
    error: "en erreur",
    missing_key: "clé manquante",
    ok: "opérationnel",
    unavailable: "indisponible",
    unknown: "état inconnu",
  } as Record<string, string>)[normalized] || normalized.replace(/[_-]+/g, " ");
}

function readableSubsystemMessage(message: string) {
  const trimmed = String(message || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (lower.includes("llm api key is not configured")) {
    return "Aucune clé IA n'est configurée pour le fournisseur choisi.";
  }
  if (lower.includes("lancedb") && lower.includes("n'est pas installé")) {
    return "Le runtime vectoriel LanceDB n'est pas encore installé.";
  }
  return trimmed;
}

function SubsystemBanner({
  items,
  onSettings,
  onActivity,
}: {
  items: Array<[string, SubsystemHealth[string]]>;
  onSettings: () => void;
  onActivity: () => void;
}) {
  if (items.length === 0) return null;
  const summary = items.map(([name, value]) => `${readableSubsystemName(name)} : ${readableSubsystemStatus(value.status)}`).join(" | ");
  const detail = items
    .map(([name, value]) => {
      const message = readableSubsystemMessage(String(value.error || value.reason || ""));
      return message ? `${readableSubsystemName(name)}: ${message}` : "";
    })
    .filter(Boolean)
    .join(" | ");
  return (
    <div className="subsystem-banner" role="status">
      <strong>{items.length > 1 ? "Sous-systèmes à vérifier" : "Sous-système à vérifier"}</strong>
      <span>{summary}</span>
      {detail && <span className="subsystem-banner-detail">{detail}</span>}
      <div className="subsystem-banner-actions">
        <button className="btn btn-ghost" onClick={onSettings}>Paramètres</button>
        <button className="btn btn-ghost" onClick={onActivity}>Activité</button>
      </div>
    </div>
  );
}

function StartupScreen({ conn, port, seconds, sidecarError }: { conn: string; port: number | null; seconds: number; sidecarError: string | null }) {
  const isSlow = seconds >= 20;
  const browserOnly = !hasDesktopBridge();
  const desktopCommand = "pnpm dev:local";
  const startupError = readableStartupError(sidecarError);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const copiedCommandTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (copiedCommandTimerRef.current) window.clearTimeout(copiedCommandTimerRef.current);
  }, []);
  const copyDesktopCommand = useCallback(() => {
    void copyTextToClipboard(desktopCommand).then(copied => {
      if (!copied) return;
      setCopiedCommand(true);
      if (copiedCommandTimerRef.current) window.clearTimeout(copiedCommandTimerRef.current);
      copiedCommandTimerRef.current = window.setTimeout(() => setCopiedCommand(false), 1800);
    });
  }, [desktopCommand]);
  return (
    <div style={{
      minHeight: "100vh",
      width: "100vw",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      background: "var(--paper)",
      color: "var(--ink)",
      padding: 24,
    }}>
      <section className="card col gap-4" style={{ width: "min(720px, 100%)", padding: 30 }}>
        <div className="row gap-3">
          <div className="spinner" />
          <div>
            <div className="eyebrow">Lancement de Juste Recrute Moi</div>
            <h1 style={{ fontSize: 30, marginTop: 6 }}>Préparation de votre espace local</h1>
          </div>
        </div>
        <p style={{ color: "var(--ink-2)", lineHeight: 1.6, maxWidth: 620 }}>
          {browserOnly
            ? "Le frontend est ouvert seul dans le navigateur. Pour utiliser les scans, la base locale et la génération, lancez l'application desktop avec son backend intégré."
            : "L'application desktop démarre son backend intégré, ouvre la base locale et attend le jeton privé de l'API."}
          {!browserOnly && " Le guide de configuration s'affichera automatiquement dès que le backend sera prêt."}
        </p>
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          <span className="pill">Backend : {connLabel(conn)}</span>
          <span className="pill">Port : {port ?? "en attente"}</span>
          <span className="pill">Temps écoulé : {seconds}s</span>
        </div>
        {browserOnly && (
          <div style={{
            border: "1px solid var(--blue)",
            borderRadius: 8,
            padding: 14,
            background: "var(--blue-soft)",
            color: "var(--blue-ink)",
            lineHeight: 1.55,
          }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Mode frontend seul détecté</div>
            <div>
              Cette page permet de vérifier l'interface, mais les scans, la base locale, les fichiers et les réglages sécurisés passent par l'app desktop.
            </div>
            <div className="row gap-2" style={{ marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span>Lancez l'expérience complète avec</span>
              <span className="mono" style={{ padding: "6px 10px", borderRadius: 8, background: "var(--paper)", border: "1px solid var(--line)" }}>{desktopCommand}</span>
              <button className="btn btn-ghost" onClick={copyDesktopCommand} type="button">
                {copiedCommand ? "Commande copiée" : "Copier la commande"}
              </button>
            </div>
          </div>
        )}
        {isSlow && !browserOnly && (
          <div style={{
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: 14,
            background: "var(--paper-3)",
            color: "var(--ink-2)",
            lineHeight: 1.55,
          }}>
            Le démarrage prend plus de temps que prévu. Si cet écran reste affiché, le backend intégré n'a probablement pas démarré.
            Sur macOS, ouvrez Confidentialité et sécurité &gt; Ouvrir quand même si l'application a été bloquée, puis relancez Juste Recrute Moi.
          </div>
        )}
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          <button className="btn" onClick={() => window.location.reload()}>
            Réessayer la connexion
          </button>
        </div>
        {startupError && (
          <div style={{
            border: "1px solid var(--bad)",
            borderRadius: 8,
            padding: 14,
            background: "var(--bad-soft)",
            color: "var(--bad)",
            lineHeight: 1.55,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}>
            <strong style={{ display: "block", marginBottom: 6, fontFamily: "inherit" }}>Diagnostic de démarrage</strong>
            {startupError}
          </div>
        )}
      </section>
      <CreatorFooter compact />
    </div>
  );
}

function BackendUnavailable({ title, conn, port }: { title: string; conn: string; port: number | null }) {
  return (
    <div className="ingestion-page scroll">
      <div className="ingestion-shell">
        <div className="card col gap-4" style={{ padding: 28 }}>
          <div className="row gap-3">
            <div className="spinner" />
            <div>
              <div className="eyebrow">Démarrage du backend local</div>
              <h2 style={{ marginTop: 6 }}>{title} s'affichera automatiquement</h2>
            </div>
          </div>
          <p style={{ color: "var(--ink-2)", maxWidth: 620, lineHeight: 1.6 }}>
            Juste Recrute Moi attend que le sidecar intégré publie son jeton API et son port. Cela devrait prendre quelques secondes après le lancement.
          </p>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <span className="pill">Connexion : {connLabel(conn)}</span>
            <span className="pill">Port : {port ?? "en attente"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
