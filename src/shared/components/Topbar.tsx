import type { ReactNode } from "react";
import Icon from "./Icon";
import type { OperationProgress, View } from "../../types";
import { useAppVersion } from "../hooks/useAppVersion";
import { emitAppEvent } from "../lib/appEvents";
import { useTheme } from "../lib/theme";

export function Topbar({ view, progress }: { view: View; progress?: OperationProgress }) {
  const appVersion = useAppVersion();
  const { resolved, setPref } = useTheme();
  const progressLabel = progress?.mode === "cleanup" ? "Nettoyage" : progress?.mode === "reevaluate" ? "Re-score" : "Scan";
  const progressPercent = progress?.total ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : null;
  const titles: Record<View, string> = {
    apply:     "Adapter une offre",
    dashboard: "Centre de recherche",
    pipeline:  "Pipeline d'offres",
    "pipeline-hot": "Offres prioritaires",
    "pipeline-found": "Nouvelles offres",
    "pipeline-evaluated": "Offres notées",
    "pipeline-generated": "Offres prêtes",
    "pipeline-applied": "Offres postulées",
    "pipeline-discarded": "Offres masquées",
    graph:     "Graphe de connaissances",
    activity:  "Activité en direct",
    profile:   "Profil",
    ingestion: "Ajouter du contexte",
  };
  const subtitles: Record<View, string> = {
    apply: "Adapte CV, lettre et approche pour une offre précise",
    dashboard: "Recherche, trie et avance les meilleures offres",
    pipeline: "Suit les offres, les favoris et les candidatures",
    "pipeline-hot": "Offres avec le meilleur signal à traiter en premier",
    "pipeline-found": "Offres fraîchement découvertes à évaluer",
    "pipeline-evaluated": "Offres avec score de pertinence ou de qualité",
    "pipeline-generated": "Dossiers prêts ou en cours d'adaptation",
    "pipeline-applied": "Offres déjà marquées comme postulées",
    "pipeline-discarded": "Offres rejetées, masquées ou trop faibles",
    graph: "Contexte local du profil utilisé pour le matching",
    activity: "Événements backend et logs de l'agent",
    profile: "Détails candidat utilisés pour l'adaptation",
    ingestion: "Ajoute CV, projets, portfolio et contexte GitHub",
  };
  return (
    <header className="topbar">
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: 0 }}>{titles[view]}</h2>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{subtitles[view]}</div>
      </div>
      {view === "profile" && (
        <button className="btn" onClick={() => emitAppEvent("profile-export")}>
          <Icon name="download" size={13} /> Exporter le graphe
        </button>
      )}
      {progress?.active && (
        <div style={{
          width: 250,
          minWidth: 180,
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>{progressLabel}</span>
            <span>{progress.total ? `${Math.min(progress.completed, progress.total)}/${progress.total}` : progress.completed}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--paper-3)", overflow: "hidden", border: "1px solid var(--line)" }}>
            <div style={{
              width: `${progressPercent ?? 12}%`,
              minWidth: progress.completed ? 8 : 0,
              height: "100%",
              background: "var(--green)",
              transition: "width 180ms ease",
            }} />
          </div>
          {progress.current && (
            <div title={progress.current} style={{ fontSize: 10.5, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {progress.current}
            </div>
          )}
        </div>
      )}
      <button
        className="btn btn-icon"
        onClick={() => setPref(resolved === "dark" ? "light" : "dark")}
        title={resolved === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
        aria-label="Changer de thème"
      >
        <Icon name={resolved === "dark" ? "sun" : "moon"} size={15} />
      </button>
      <div className="topbar-version mono" title={`Juste Recrute Moi version ${appVersion}`}>v{appVersion}</div>
    </header>
  );
}

/* ══════════════════════════════════════
   DASHBOARD VIEW
══════════════════════════════════════ */

type StatCardProps = {
  tone: string;
  label: string;
  value: ReactNode;
  sub: string;
  icon: string;
};

export const StatCard = ({ tone, label, value, sub, icon }: StatCardProps) => (
  <div style={{
    background: `var(--${tone}-soft)`,
    border: `1px solid var(--${tone})`,
    borderRadius: 16, padding: 18,
    display: "flex", flexDirection: "column", gap: 12,
    minHeight: 132,
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 9,
      background: `var(--${tone})`, color: `var(--${tone}-ink)`,
      display: "grid", placeItems: "center",
    }}>
      <Icon name={icon} size={15} />
    </div>
    <div className="col" style={{ gap: 4 }}>
      <div className="display tabular" style={{ fontSize: 40, color: `var(--${tone}-ink)`, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{label}</div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{sub}</div>
    </div>
  </div>
);
