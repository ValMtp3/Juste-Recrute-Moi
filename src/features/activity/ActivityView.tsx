import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../shared/components/Icon";
import type { LogLine, View } from "../../types";
import { copyTextToClipboard } from "../../shared/lib/clipboard";

type ActivityTab = "all" | "scout" | "eval" | "customize" | "system";

const ACTIVITY_TABS: { id: ActivityTab; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "scout", label: "Collecte" },
  { id: "eval", label: "Score" },
  { id: "customize", label: "Adaptation" },
  { id: "system", label: "Système" },
];

function visibleForTab(logs: LogLine[], tab: ActivityTab) {
  return logs.filter(l => {
    const message = l.msg.toLowerCase();
    if (tab === "all") return l.kind !== "heartbeat";
    if (tab === "scout") return l.src === "scout" || (l.kind === "agent" && message.includes("scout"));
    if (tab === "eval") return l.src === "eval" || (l.kind === "agent" && (message.includes("eval") || message.includes("scor")));
    if (tab === "customize") return l.src === "apply" || (l.kind === "agent" && (message.includes("custom") || message.includes("generat") || message.includes("package")));
    if (tab === "system") return l.kind === "system";
    return true;
  });
}

function activityKindLabel(kind: LogLine["kind"]) {
  return ({ heartbeat: "signal", agent: "agent", system: "système" } as Record<LogLine["kind"], string>)[kind] || kind;
}

function activitySourceLabel(src: string) {
  const value = String(src || "").toLowerCase();
  if (value === "hb") return "Rythme";
  if (value === "ws") return "Connexion";
  if (value === "sidecar") return "Backend";
  if (value === "scout" || value.includes("scan") || value.includes("eval_start") || value.includes("eval_done")) return "Collecte";
  if (value === "eval" || value.includes("eval_scored") || value.includes("reeval")) return "Score";
  if (value === "apply" || value.includes("custom") || value.includes("generat")) return "Adaptation";
  if (value.includes("cleanup") || value.includes("discard")) return "Nettoyage";
  return src || "Système";
}

function activityCopyErrorMessage() {
  return "Copie impossible depuis ce navigateur. Sélectionnez le texte du flux manuellement.";
}

export function ActivityView({ logs, setView }: { logs: LogLine[]; setView: (view: View) => void }) {
  const [actTab, setActTab] = useState<ActivityTab>("all");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const visibleLogs = useMemo(() => visibleForTab(logs, actTab), [actTab, logs]);
  const tabCounts = useMemo(() => Object.fromEntries(ACTIVITY_TABS.map(tab => [tab.id, visibleForTab(logs, tab.id).length])) as Record<ActivityTab, number>, [logs]);
  const latestVisibleLog = visibleLogs[0] || null;

  useEffect(() => () => {
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
  }, []);

  const copyThinking = async () => {
    const body = visibleLogs
      .map(ln => `[${ln.ts}] ${activityKindLabel(ln.kind)} ${activitySourceLabel(ln.src)}: ${ln.msg}`)
      .join("\n");
    const text = body || "Aucun journal agent visible.";
    try {
      const copiedText = await copyTextToClipboard(text);
      if (!copiedText) throw new Error("clipboard unavailable");
      setCopyError(null);
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopyError(activityCopyErrorMessage());
    }
  };

  return (
    <div className="scroll" style={{ padding: 24, flex: 1, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {ACTIVITY_TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActTab(tab.id); setCopyError(null); }} style={{
            padding: "5px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
            border: actTab === tab.id ? "none" : "1px solid var(--line)",
            background: actTab === tab.id ? "var(--ink)" : "var(--paper)",
            color: actTab === tab.id ? "var(--card)" : "var(--ink-3)",
            transition: "all 0.15s ease",
          }}>
            {tab.label} <span className="mono" style={{ opacity: 0.72 }}>{tabCounts[tab.id]}</span>
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: "26px 28px", marginBottom: 18, background: "var(--orange-soft)" }}>
        <span className="eyebrow">Flux temps réel</span>
        <h1 style={{ fontSize: 44 }}>Que fait l'agent <span className="italic-serif">maintenant ?</span></h1>
      </div>
      <div className="card" style={{ padding: 18, background: "var(--purple-soft)" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3>Flux</h3>
          <div className="row gap-2">
            <button className="btn btn-ghost" onClick={copyThinking} style={{ fontSize: 12 }}>
              {copied ? "Copié" : "Copier le flux"}
            </button>
            <span className="pill" style={{ background: "var(--green)", color: "var(--green-ink)" }}>
              <span className="dot pulse-soft" /> direct
            </span>
          </div>
        </div>
        <div className="row gap-2" style={{ marginBottom: 12, flexWrap: "wrap" }}>
          <span className="pill mono" style={{ background: "var(--paper)", color: "var(--purple-ink)", border: "1px solid var(--purple)" }}>
            {visibleLogs.length} événement{visibleLogs.length > 1 ? "s" : ""} visible{visibleLogs.length > 1 ? "s" : ""}
          </span>
          {latestVisibleLog && (
            <span className="pill mono" style={{ background: "var(--paper)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
              Dernier : {activitySourceLabel(latestVisibleLog.src)}
            </span>
          )}
        </div>
        <div style={{ height: 440, display: "flex" }}>
          <div className="scroll terminal" style={{ background: "var(--term-bg)", color: "var(--term-fg)", borderRadius: 12, padding: "14px 16px", flex: 1 }}>
            {copyError && (
              <div style={{ marginBottom: 10, color: "var(--bad)", fontSize: 12 }}>{copyError}</div>
            )}
            {visibleLogs.length === 0 ? (
              <div className="activity-empty">
                <Icon name={logs.length === 0 ? "pulse" : "filter"} size={22} />
                <h3>{logs.length === 0 ? "Aucune activité enregistrée" : "Aucun événement dans ce filtre"}</h3>
                <p>{logs.length === 0 ? "Lancez un scan ou adaptez une offre pour alimenter le journal." : "Changez de filtre ou revenez sur Tout pour revoir le flux complet."}</p>
                <div className="activity-empty-actions">
                  {logs.length === 0 ? (
                    <>
                      <button className="btn btn-accent" onClick={() => setView("dashboard")}>Ouvrir l'accueil</button>
                      <button className="btn" onClick={() => setView("apply")}>Adapter une offre</button>
                    </>
                  ) : (
                    <button className="btn" onClick={() => setActTab("all")}>Voir tout</button>
                  )}
                </div>
              </div>
            ) : visibleLogs.map(ln => {
              const tone = ln.kind === "heartbeat" ? "blue" : ln.kind === "agent" ? "green" : "yellow";
              return (
                <div key={ln.id} className="row gap-3" style={{ marginBottom: 5, alignItems: "baseline" }}>
                  <span className="mono tabular" style={{ color: "var(--term-dim)", fontSize: 10.5, minWidth: 50 }}>{ln.ts}</span>
                  <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "1px 6px", borderRadius: 4, background: `var(--${tone})`, color: `var(--${tone}-ink)`, minWidth: 42, textAlign: "center" }}>{activityKindLabel(ln.kind)}</span>
                  <span style={{ color: "var(--term-mid)", fontSize: 11 }}>{activitySourceLabel(ln.src)}</span>
                  <span style={{ flex: 1 }}>{ln.msg}</span>
                </div>
              );
            })}
            <div className="row gap-2" style={{ marginTop: 4 }}>
              <span style={{ color: "var(--accent)" }}>{">"}</span>
              <span className="blink">|</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
