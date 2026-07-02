import { useEffect, useRef, useState } from "react";
import { openExternalUrl } from "../../../shared/lib/openExternal";
import Icon from "../../../shared/components/Icon";
import type { ApiFetch, Lead } from "../../../types";
import { GENERATION_TIMEOUT_MS } from "../../../api/generation";
import { getMark, getTone, leadDisplayHeading, leadSeniority, leadStatusLabel, seniorityLabel, seniorityTone } from "../../../shared/lib/leadUtils";
import { emitAppEvent } from "../../../shared/lib/appEvents";
import { readJsonResponse, responseErrorMessage } from "../../../shared/lib/httpError";

const sourceReliability = (lead: Lead) => {
  const raw = String(lead.source_meta?.source_reliability || "").toLowerCase();
  if (raw === "stable") return { label: "Stable", tone: "green" };
  if (raw === "manual") return { label: "Manuel", tone: "blue" };
  if (raw === "best_effort") return { label: "À vérifier", tone: "yellow" };
  return null;
};

function readableGenerationError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return "La génération du dossier a échoué.";
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("backend local")) {
    return "Backend local injoignable. Vérifiez que l'app est bien démarrée, puis réessayez.";
  }
  if (lower.includes("signal is aborted") || lower.includes("aborterror")) {
    return "Génération arrêtée. Vous pouvez relancer depuis cette carte.";
  }
  if (lower.includes("no url available")) {
    return "Aucune URL exploitable n'est disponible pour cette offre. Ouvrez l'offre et ajoutez la description complète.";
  }
  if (lower.includes("api key") || lower.includes("llm")) {
    return "La génération a besoin d'une clé IA valide. Vérifiez le fournisseur et la clé dans les paramètres.";
  }
  if (lower.includes("génération échouée")) {
    return "La génération n'a pas pu démarrer. Vérifiez Activité, puis réessayez.";
  }
  if (lower.includes("generation failed")) {
    return "La génération n'a pas pu démarrer. Vérifiez Activité, puis réessayez.";
  }
  if (lower.includes("réponse de génération illisible")) {
    return "La génération a répondu avec un résultat illisible. Vérifiez Activité, puis relancez la génération.";
  }
  return trimmed;
}

function readableOpenLeadError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const lower = raw.toLowerCase();
  if (lower.includes("missing")) return "Aucune URL source n'est disponible pour cette offre.";
  if (lower.includes("invalid") || lower.includes("unsupported")) return "Lien source invalide ou non web. Ouvrez les détails pour vérifier l'offre.";
  return "Le lien source n'a pas pu être ouvert. Copiez-le depuis les détails si besoin.";
}

async function openLeadUrl(url: string | null | undefined) {
  if (!url) throw new Error("missing-url");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("invalid-url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported-url");
  await openExternalUrl(url);
}

async function generateLeadDocument(api: ApiFetch, jobId: string, signal: AbortSignal) {
  const response = await api(`/api/v1/leads/${jobId}/generate`, {
    method: "POST",
    signal,
    timeoutMs: GENERATION_TIMEOUT_MS,
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, `Génération échouée (${response.status})`));
  return await readJsonResponse<{ lead?: Lead }>(response, "Réponse de génération illisible");
}

export function JobCard({ lead, onOpen, onDelete, showScore = false, showGenerate = false, port, api }: {
  lead: Lead;
  onOpen: (l: Lead) => void;
  onDelete: (id: string) => void;
  showScore?: boolean;
  showGenerate?: boolean;
  port?: number | null;
  api?: ApiFetch | null;
}) {
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const desc = lead.description?.trim();
  const signalScore = lead.signal_score || 0;
  const qualityReason = String(lead.lead_quality_reason || lead.source_meta?.lead_quality_reason || "");
  const qualityScore = Number(lead.lead_quality_score || lead.source_meta?.lead_quality_score || 0);
  const isHotX = lead.platform === "x" && signalScore >= 80;
  const level = leadSeniority(lead);
  const levelTone = seniorityTone(level);
  const reliability = sourceReliability(lead);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!port || !api) return;
    setGenerating(true);
    setGenerationError(null);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const body = await generateLeadDocument(api, lead.job_id, controller.signal);
      if (body.lead) emitAppEvent("lead-updated", body.lead);
      emitAppEvent("leads-refresh");
    } catch (error) {
      console.error("La génération du dossier a échoué", error);
      if (!controller.signal.aborted) setGenerationError(readableGenerationError(error));
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setGenerating(false);
    }
  };

  const handleOpenSource = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLinkError(null);
    try {
      await openLeadUrl(lead.url);
    } catch (error) {
      setLinkError(readableOpenLeadError(error));
    }
  };

  useEffect(() => () => requestRef.current?.abort(), []);

  return (
    <div className="card lift" style={{
      padding: 16, cursor: "pointer", border: "1px solid var(--line)",
      background: "var(--card)", display: "flex", flexDirection: "column", gap: 10,
    }} onClick={() => onOpen(lead)}>
      {/* Header row */}
      <div className="row gap-3" style={{ alignItems: "flex-start" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `var(--${getTone(lead.status)})`, color: `var(--${getTone(lead.status)}-ink)`,
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500,
          border: `1px solid var(--${getTone(lead.status)}-ink)`,
        }}>{getMark(lead.company)}</div>
        <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.25, color: "var(--ink)" }}>{lead.title}</div>
          <div className="row gap-2" style={{ alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{lead.company}</span>
            <span style={{ color: "var(--ink-4)", fontSize: 10 }}>·</span>
            <span className="pill mono" style={{ fontSize: 8.5, padding: "1px 6px" }}>{lead.platform}</span>
            <span className="pill mono" style={{ fontSize: 8.5, padding: "1px 6px", background: `var(--${levelTone}-soft)`, color: `var(--${levelTone}-ink)`, border: `1px solid var(--${levelTone})` }}>{seniorityLabel(level)}</span>
            {isHotX && <span className="pill mono" style={{ fontSize: 8.5, padding: "1px 6px", background: "var(--orange-soft)", color: "var(--orange-ink)", border: "1px solid var(--orange)" }}>HOT X</span>}
            {reliability && <span className="pill mono" style={{ fontSize: 8.5, padding: "1px 6px", background: `var(--${reliability.tone}-soft)`, color: `var(--${reliability.tone}-ink)`, border: `1px solid var(--${reliability.tone})` }}>{reliability.label}</span>}
            {lead.budget && <span className="pill mono" style={{ fontSize: 8.5, padding: "1px 6px", background: "var(--green-soft)", color: "var(--green-ink)" }}>{lead.budget}</span>}
          </div>
        </div>
        {signalScore > 0 && (
          <span style={{
            flexShrink: 0, fontSize: 11.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
            background: signalScore >= 80 ? "var(--orange-soft)" : signalScore >= 60 ? "var(--yellow-soft)" : "var(--paper-3)",
            color: signalScore >= 80 ? "var(--orange-ink)" : signalScore >= 60 ? "var(--yellow-ink)" : "var(--ink-3)",
            border: `1px solid ${signalScore >= 80 ? "var(--orange)" : "var(--line)"}`,
          }}>{signalScore}</span>
        )}
        {/* Score badge */}
        {showScore && lead.score > 0 && (
          <span style={{
            flexShrink: 0, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
            background: lead.score >= 85 ? "var(--green)" : lead.score >= 50 ? "var(--yellow)" : "var(--bad-soft)",
            color:      lead.score >= 85 ? "var(--green-ink)" : lead.score >= 50 ? "var(--yellow-ink)" : "var(--bad)",
          }}>{lead.score}%</span>
        )}
        {/* Delete button */}
        <button
          onClick={e => { e.stopPropagation(); onDelete(lead.job_id); }}
          title="Supprimer"
          style={{
            flexShrink: 0, width: 26, height: 26, borderRadius: 7,
            border: "1px solid var(--line)", background: "var(--paper)",
            color: "var(--bad)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, lineHeight: 1, padding: 0, opacity: 0.7,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
        >×</button>
      </div>

      {/* Description */}
      {desc ? (
        <div style={{
          fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
          overflow: "hidden",
          background: "var(--paper-3)", borderRadius: 8, padding: "8px 10px",
          border: "1px solid var(--line)",
        }}>{desc}</div>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--ink-4)", fontStyle: "italic" }}>Aucune description extraite.</div>
      )}

      {/* Evaluator reason (for Evaluated tab) */}
      {showScore && lead.reason && (
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5, borderLeft: "2px solid var(--line)", paddingLeft: 8 }}>
          {lead.reason.slice(0, 160)}{lead.reason.length > 160 ? "…" : ""}
        </div>
      )}

      {lead.signal_reason && (
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5, borderLeft: "2px solid var(--orange)", paddingLeft: 8 }}>
          {lead.signal_reason.slice(0, 150)}{lead.signal_reason.length > 150 ? "..." : ""}
        </div>
      )}

      {qualityReason && (
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5, borderLeft: "2px solid var(--blue)", paddingLeft: 8 }}>
          Affichée par le filtre qualité{qualityScore ? ` (${qualityScore})` : ""} : {qualityReason.slice(0, 150)}{qualityReason.length > 150 ? "..." : ""}
        </div>
      )}

      {generationError && (
        <div style={{ fontSize: 11.5, color: "var(--bad)", lineHeight: 1.5, border: "1px solid var(--bad)", background: "var(--bad-soft)", borderRadius: 8, padding: "7px 9px" }}>
          {generationError}
        </div>
      )}
      {linkError && (
        <div style={{ fontSize: 11.5, color: "var(--bad)", lineHeight: 1.5, border: "1px solid var(--bad)", background: "var(--bad-soft)", borderRadius: 8, padding: "7px 9px" }}>
          {linkError}
        </div>
      )}

      {/* Footer */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        <button
          onClick={handleOpenSource}
          title={lead.url}
          style={{ fontSize: 11, color: "var(--teal)", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          <Icon name="external-link" size={11} color="var(--teal)" />
          {lead.url.replace(/^https?:\/\//, "").slice(0, 50)}
        </button>
        <div className="row gap-2">
          {showGenerate && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                border: "1px solid var(--purple)", background: "var(--purple-soft)",
                color: "var(--purple-ink)", cursor: generating ? "wait" : "pointer",
              }}
            >{generating ? "En file..." : "Générer le dossier"}</button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onOpen(lead); }}
            style={{
              padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
              border: "1px solid var(--line)", background: "var(--paper)",
              color: "var(--ink-2)", cursor: "pointer",
            }}
          >Détails →</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PIPELINE VIEW (tabbed)
══════════════════════════════════════ */

export function PipelineJobCard({ lead, onOpen, onDelete, deleting = false, showGenerate = false, port, api }: {
  lead: Lead;
  onOpen: (l: Lead) => void;
  onDelete: (id: string) => void | Promise<void>;
  deleting?: boolean;
  showGenerate?: boolean;
  port?: number | null;
  api?: ApiFetch | null;
}) {
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const signalScore = lead.signal_score || 0;
  const matchScore = lead.score || 0;
  const qualityScore = Number(lead.lead_quality_score || lead.source_meta?.lead_quality_score || 0);
  const isHotX = lead.platform === "x" && signalScore >= 80;
  const level = leadSeniority(lead);
  const levelTone = seniorityTone(level);
  const statusTone = getTone(lead.status);
  const statusLabel = leadStatusLabel(lead.status);
  const display = leadDisplayHeading(lead);
  const urlLabel = lead.url ? lead.url.replace(/^https?:\/\//, "").slice(0, 42) : "Aucune URL source";
  const reliability = sourceReliability(lead);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!port || !api) return;
    setGenerating(true);
    setGenerationError(null);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const body = await generateLeadDocument(api, lead.job_id, controller.signal);
      if (body.lead) emitAppEvent("lead-updated", body.lead);
      emitAppEvent("leads-refresh");
    } catch (error) {
      console.error("La génération du dossier a échoué", error);
      if (!controller.signal.aborted) setGenerationError(readableGenerationError(error));
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setGenerating(false);
    }
  };

  const handleOpenSource = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLinkError(null);
    try {
      await openLeadUrl(lead.url);
    } catch (error) {
      setLinkError(readableOpenLeadError(error));
    }
  };

  useEffect(() => () => requestRef.current?.abort(), []);

  return (
    <div className="pipeline-job-card lift" data-status={lead.status || "discovered"} onClick={() => onOpen(lead)}>
      <div className="pipeline-job-mark" style={{ background: `var(--${statusTone}-soft)`, color: `var(--${statusTone}-ink)`, borderColor: `var(--${statusTone})` }}>
        {getMark(lead.company)}
      </div>
      <div className="pipeline-job-main">
        <div className="pipeline-job-title-row">
          <div className="pipeline-job-title">
            <span>{display.role}</span>
            <b>chez</b>
            <span className="company">{display.company}</span>
          </div>
          <span className="pipeline-status-pill" style={{ background: `var(--${statusTone}-soft)`, color: `var(--${statusTone}-ink)`, borderColor: `var(--${statusTone})` }}>
            {statusLabel}
          </span>
        </div>
        <div className="pipeline-job-meta">
          <span>{lead.platform || "source"}</span>
          <span style={{ color: `var(--${levelTone}-ink)` }}>{seniorityLabel(level)}</span>
          {reliability && <span style={{ color: `var(--${reliability.tone}-ink)` }}>{reliability.label}</span>}
          {isHotX && <span style={{ color: "var(--orange-ink)" }}>Hot X</span>}
          {lead.budget && <span style={{ color: "var(--green-ink)" }}>{lead.budget}</span>}
        </div>
      </div>
      <div className="pipeline-job-side">
        <div className="pipeline-score-stack">
          {matchScore > 0 && <span className={`pipeline-score ${matchScore >= 76 ? "good" : matchScore >= 50 ? "warn" : "bad"}`}>Match {matchScore}</span>}
          {signalScore > 0 && <span className={`pipeline-score ${signalScore >= 80 ? "hot" : signalScore >= 60 ? "warn" : ""}`}>Signal {signalScore}</span>}
          {qualityScore > 0 && <span className={`pipeline-score ${qualityScore >= 80 ? "hot" : qualityScore >= 60 ? "warn" : ""}`}>Qualité {qualityScore}</span>}
        </div>
        <div className="pipeline-job-actions">
          {showGenerate && (
            <button className="btn" onClick={handleGenerate} disabled={generating}>
              <Icon name="file" size={12} /> {generating ? "En file" : "Générer"}
            </button>
          )}
          <button className="btn btn-icon" onClick={handleOpenSource} title={lead.url} disabled={!lead.url}>
            <Icon name="external-link" size={13} />
          </button>
          <button className="btn" onClick={e => { e.stopPropagation(); onOpen(lead); }}>Détails</button>
          <button className="btn btn-icon danger" onClick={e => { e.stopPropagation(); onDelete(lead.job_id); }} title={deleting ? "Suppression en cours" : "Supprimer l'offre"} disabled={deleting}>
            {deleting ? <span className="spinner-sm" aria-hidden="true" /> : <Icon name="trash" size={13} />}
          </button>
        </div>
        <div className="pipeline-source mono" title={lead.url}>{urlLabel}</div>
        {generationError && <div className="pipeline-inline-error">{generationError}</div>}
        {linkError && <div className="pipeline-inline-error">{linkError}</div>}
      </div>
    </div>
  );
}

export function PipelineSkeleton() {
  return (
    <div className="pipeline-skeleton">
      <div className="pipeline-skeleton-bar" />
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="pipeline-skeleton-card">
          <span />
          <div>
            <i />
            <b />
            <em />
          </div>
          <strong />
        </div>
      ))}
    </div>
  );
}
