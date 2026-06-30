import { useEffect, useRef, useState } from "react";
import Icon from "../../shared/components/Icon";
import type React from "react";
import type { ApiFetch, Lead, LogLine, OperationProgress, View } from "../../types";
import { getMark, getTone, leadDisplayHeading, leadSignal, leadStatusLabel } from "../../shared/lib/leadUtils";
import { DebugResetButton } from "../../shared/components/DebugResetButton";
import { settingsApi } from "../../api/settings";
import { readJsonResponse, responseErrorMessage } from "../../shared/lib/httpError";

function readableDashboardError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("backend local")) {
    return "Backend local injoignable. Vérifiez que l'app est bien démarrée, puis réessayez.";
  }
  if (lower.includes("unexpected token") || lower.includes("json")) return fallback;
  if (lower.includes("préférences") || lower.includes("preferences")) return fallback;
  return trimmed;
}

/**
 * "Ce que vous recherchez" — free-text preferences the agent uses to target the
 * scan and rank matching jobs higher. Loads + saves the job_preferences setting
 * directly (on blur), so it survives restarts and feeds the next scan/evaluation.
 */
function PreferencesBox({ api }: { api: ApiFetch | null }) {
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [errorMessage, setErrorMessage] = useState("");
  const lastSaved = useRef("");
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!api) return;
    let alive = true;
    settingsApi.getPreferences(api).then(async r => {
      if (!r.ok) throw new Error(await responseErrorMessage(r, "Les préférences n'ont pas pu être chargées."));
      return readJsonResponse<Record<string, unknown>>(
        r,
        "Les préférences ont répondu dans un format illisible.",
      );
    }).then(d => {
      if (!alive) return;
      const v = String(d?.preferences || "");
      setValue(v); lastSaved.current = v; setLoaded(true);
    }).catch(err => {
      if (!alive) return;
      setErrorMessage(readableDashboardError(err, "Les préférences n'ont pas pu être chargées."));
      setLoaded(true);
    });
    return () => {
      alive = false;
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, [api]);

  const save = async () => {
    if (!api || value === lastSaved.current) return;
    setStatus("saving");
    setErrorMessage("");
    try {
      const r = await settingsApi.savePreferences(api, value);
      if (!r.ok) throw new Error(await responseErrorMessage(r, "Les préférences n'ont pas pu être enregistrées."));
      lastSaved.current = value;
      setStatus("saved");
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = window.setTimeout(() => setStatus(""), 1800);
    } catch (err: unknown) {
      setErrorMessage(readableDashboardError(err, "Les préférences n'ont pas pu être enregistrées."));
      setStatus("error");
    }
  };

  return (
    <section className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">Ce que vous recherchez</span>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 }}>
            Décrivez votre poste idéal en français simple : l'agent l'utilise pour <b>cibler la recherche</b> et <b>remonter les offres les plus pertinentes</b>.
          </div>
        </div>
        {status === "saved" && <span className="pill" style={{ background: "var(--green-soft)", color: "var(--green-ink)", border: "1px solid var(--green)" }}>Enregistré</span>}
        {status === "saving" && <span className="pill">Enregistrement...</span>}
        {status === "error" && <span className="pill" style={{ background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid var(--bad)" }}>Échec</span>}
      </div>
      <textarea
        className="field-input"
        rows={2}
        value={value}
        disabled={!loaded}
        placeholder="ex. fullstack React/Node, remote ou Montpellier, CDI, produit SaaS, pas d'astreinte, équipe tech solide"
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        style={{ width: "100%", resize: "vertical", fontSize: 13, lineHeight: 1.55 }}
      />
      {errorMessage && <div role="alert" style={{ marginTop: 8, fontSize: 12, color: "var(--bad)", lineHeight: 1.45 }}>{errorMessage}</div>}
    </section>
  );
}

const warmSurface = "rgba(var(--white-rgb), 0.64)";
const warmSurfaceStrong = "rgba(var(--white-rgb), 0.78)";
const warmBorder = "rgba(var(--accent-rgb), 0.16)";

const MiniStat = ({ tone, label, value, hint, icon }: { tone: string; label: string; value: number; hint: string; icon: string }) => (
  <div style={{
    border: `1px solid color-mix(in srgb, var(--${tone}) 72%, transparent)`,
    background: `linear-gradient(135deg, var(--${tone}-soft) 0%, rgba(var(--white-rgb),0.48) 100%)`,
    borderRadius: 8,
    padding: 14,
    minHeight: 104,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  }}>
    <div style={{
      width: 30,
      height: 30,
      borderRadius: 8,
      background: `var(--${tone})`,
      color: `var(--${tone}-ink)`,
      display: "grid",
      placeItems: "center",
    }}>
      <Icon name={icon} size={14} />
    </div>
    <div>
      <div className="display tabular" style={{ fontSize: 34, color: `var(--${tone}-ink)`, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>{hint}</div>
    </div>
  </div>
);

const LeadRow = ({ lead, openDrawer }: { lead: Lead; openDrawer: (l: Lead) => void }) => {
  const { role, company } = leadDisplayHeading(lead);
  const signal = leadSignal(lead);
  const tone = getTone(lead.status);
  return (
    <button
      onClick={() => openDrawer(lead)}
      className="lift"
      style={{
        width: "100%",
        border: `1px solid ${warmBorder}`,
        borderRadius: 8,
        background: warmSurfaceStrong,
        padding: 10,
        display: "grid",
        gridTemplateColumns: "34px minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "center",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        background: `var(--${tone}-soft)`,
        border: `1px solid var(--${tone})`,
        color: `var(--${tone}-ink)`,
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-display)",
        fontSize: 17,
        fontWeight: 700,
      }}>{getMark(company)}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {company} / {lead.platform || "source"} / {leadStatusLabel(lead.status)}
        </div>
      </div>
      <span className="mono tabular" style={{
        fontSize: 12,
        fontWeight: 850,
        padding: "3px 8px",
        borderRadius: 999,
        background: signal >= 80 ? "var(--orange-soft)" : signal >= 55 ? "var(--yellow-soft)" : "var(--paper-3)",
        color: signal >= 80 ? "var(--orange-ink)" : signal >= 55 ? "var(--yellow-ink)" : "var(--ink-3)",
      }}>{signal}</span>
    </button>
  );
};

const SecondaryButton = ({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) => (
  <button
    className="btn"
    onClick={onClick}
    disabled={disabled}
    style={{
      minHeight: 38,
      borderRadius: 8,
      fontSize: 12,
      opacity: disabled ? 0.55 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
      background: danger ? "var(--bad-soft)" : warmSurfaceStrong,
      color: danger ? "var(--bad)" : "var(--ink-2)",
      borderColor: danger ? "var(--bad)" : warmBorder,
    }}
  >
    {children}
  </button>
);

export function DashboardView({
  leads, dueFollowups, logs, setView, openDrawer,
  scanning, reevaluating, cleaning, progress, onScan, scanSpeed, setScanSpeed, onStopScan, onReevaluate, onStopReevaluate, onCleanup, scanErr, api = null,
}: {
  leads: Lead[]; dueFollowups: Lead[]; logs: LogLine[];
  setView: (view: View) => void; openDrawer: (lead: Lead) => void;
  scanning: boolean; reevaluating: boolean; cleaning: boolean;
  progress: OperationProgress;
  onScan: (speed?: "rapide" | "moyen" | "max") => void;
  scanSpeed?: "rapide" | "moyen" | "max";
  setScanSpeed?: (speed: "rapide" | "moyen" | "max") => void;
  onStopScan: () => void; onReevaluate: () => void; onStopReevaluate: () => void; onCleanup: () => void; scanErr: string | null;
  api?: ApiFetch | null;
}) {
  const [cleanupConfirm, setCleanupConfirm] = useState(false);
  const active = leads.filter(l => l.status !== "discarded");
  const counts = {
    total: active.length,
    scored: active.filter(l => l.score > 0).length,
    ready: active.filter(l => l.status === "approved").length,
    applied: active.filter(l => l.status === "applied").length,
    tailoring: active.filter(l => l.status === "tailoring").length,
  };
  const queue = [...active]
    .sort((a, b) => leadSignal(b) - leadSignal(a) || (b.score || 0) - (a.score || 0))
    .slice(0, 4);
  const busy = scanning || reevaluating || cleaning;
  const latest = logs[0];
  const hasLeads = leads.length > 0;
  const heroTitle = scanning
    ? "Recherche en cours."
    : reevaluating
      ? "Re-score en cours."
      : cleaning
        ? "Nettoyage en cours."
        : hasLeads
          ? "Offres à traiter."
          : "Prêt à chercher.";
  const heroSubtitle = hasLeads
    ? <><b>{leads.length} offres</b> récupérées, <b>{counts.scored}</b> évaluées avec un score, <b>{counts.tailoring + counts.ready} dossiers</b> adaptés.</>
    : <>Décrivez ce que vous recherchez, vérifiez les sources, puis lancez un premier scan ou collez directement une offre.</>;
  const nowLabel = busy
    ? (scanning ? "Scan des sources configurées..." : reevaluating ? "Re-score des offres sauvegardées..." : "Nettoyage des lignes faibles...")
    : (hasLeads ? "Prêt pour la prochaine action." : "Aucune offre en base pour l'instant.");
  const requestCleanup = () => {
    if (cleanupConfirm) {
      setCleanupConfirm(false);
      onCleanup();
      return;
    }
    setCleanupConfirm(true);
  };

  return (
    <div className="scroll" style={{ padding: 24, flex: 1, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <DebugResetButton api={api} />
      </div>
      <section style={{
        border: "1px solid rgba(var(--accent-rgb),0.20)",
        borderRadius: 8,
        padding: 22,
        marginBottom: 16,
        background: "linear-gradient(135deg, var(--orange-soft) 0%, var(--pink-soft) 58%, var(--purple-soft) 100%)",
        boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(260px, 0.9fr)", gap: 22, alignItems: "end" }}>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Agent actif</div>
            <h1 style={{ fontSize: 44, marginTop: 8 }}>
              {heroTitle}
            </h1>
            <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, maxWidth: 560, marginTop: 10 }}>
              {heroSubtitle}
            </div>
            <div className="row gap-2" style={{ flexWrap: "wrap", marginTop: 16 }}>
              {scanning ? (
                <button onClick={onStopScan} style={{
                  minHeight: 48,
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  background: "var(--bad-soft)",
                  color: "var(--bad)",
                  border: "1px solid var(--bad)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <Icon name="x" size={13} color="var(--bad)" /> Arrêter
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => onScan(scanSpeed)} disabled={reevaluating || cleaning} style={{
                    minHeight: 48,
                    padding: "10px 22px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 850,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    background: reevaluating || cleaning ? "var(--ink-4)" : "var(--ink)",
                    color: "var(--paper)",
                    border: "1px solid var(--ink)",
                    cursor: reevaluating || cleaning ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: reevaluating || cleaning ? "none" : "0 4px 12px rgba(0,0,0,0.15)",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}>
                    <Icon name="spark" size={13} color="var(--paper)" /> Lancer le scan
                  </button>
                  {setScanSpeed && (
                    <select
                      value={scanSpeed || "moyen"}
                      onChange={e => setScanSpeed(e.target.value as "rapide" | "moyen" | "max")}
                      disabled={reevaluating || cleaning}
                      style={{
                        height: 48,
                        padding: "0 12px",
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--paper-2)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--ink-2)",
                        cursor: reevaluating || cleaning ? "not-allowed" : "pointer",
                      }}
                    >
                      <option value="rapide">Rapide (±5)</option>
                      <option value="moyen">Moyen (±20)</option>
                      <option value="max">Max (toutes)</option>
                    </select>
                  )}
                </div>
              )}
              {!scanning && scanSpeed === "max" && (
                <div style={{
                  fontSize: 11,
                  color: "var(--bad)",
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 500,
                }}>
                  <Icon name="alert-circle" size={13} color="var(--bad)" />
                  <span>Attention : le mode Max (150 offres/source) augmente le risque de bannissement par les fournisseurs d'API.</span>
                </div>
              )}
              <SecondaryButton onClick={() => setView("apply")} disabled={busy}>
                <Icon name="spark" size={13} /> Adapter une offre
              </SecondaryButton>
              <SecondaryButton onClick={() => setView("pipeline")}>
                Pipeline <Icon name="arrow-right" size={13} />
              </SecondaryButton>
            </div>
            {scanning && progress.active && progress.total > 0 && (
              <div style={{ marginTop: 16, maxWidth: 560 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>
                  <span>{progress.current || "Recherche..."}</span>
                  <span className="mono">{progress.completed} / {progress.total}</span>
                </div>
                <div style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    background: "var(--ink)",
                    width: `${Math.min(100, Math.max(0, (progress.completed / progress.total) * 100))}%`,
                    transition: "width 0.3s ease-out"
                  }} />
                </div>
              </div>
            )}
            {scanErr && <div style={{ marginTop: 10, fontSize: 12, color: "var(--bad)", fontWeight: 700 }}>{scanErr}</div>}
          </div>

          <div style={{
            background: warmSurface,
            border: `1px solid ${warmBorder}`,
            borderRadius: 8,
            padding: 14,
            minWidth: 0,
          }}>
            <div className="eyebrow">Maintenant</div>
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
              {nowLabel}
            </div>
            {progress?.active && (
              <div style={{ marginTop: 12 }}>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>{progress.total ? `Évaluation ${Math.min(progress.completed, progress.total)}/${progress.total} offres` : `${progress.completed} offres évaluées`}</span>
                  <span>{progress.total ? `${Math.min(100, Math.round((progress.completed / progress.total) * 100))}%` : ""}</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: "rgba(var(--white-rgb),0.64)", overflow: "hidden", border: `1px solid ${warmBorder}`, marginTop: 6 }}>
                  <div style={{
                    width: `${progress.total ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 12}%`,
                    minWidth: progress.completed ? 10 : 0,
                    height: "100%",
                    background: "var(--green)",
                    transition: "width 180ms ease",
                  }} />
                </div>
                {progress.current && (
                  <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {progress.current}
                  </div>
                )}
              </div>
            )}
            {latest && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${warmBorder}`, paddingTop: 10 }}>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{latest.ts} / {latest.kind}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45, marginTop: 4 }}>{latest.msg}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      <PreferencesBox api={api} />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <MiniStat tone="blue" label="Offres actives" value={counts.total} hint="non masquées" icon="layers" />
        <MiniStat tone="yellow" label="Notées" value={counts.scored} hint="score connu" icon="spark" />
        <MiniStat tone="green" label="Prêtes" value={counts.ready} hint="validées" icon="check" />
        <MiniStat tone="orange" label="Postulées" value={counts.applied} hint="envoyées" icon="arrow-up" />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 360px)", gap: 14 }}>
        <div style={{
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${warmBorder}`,
          background: "linear-gradient(180deg, rgba(var(--white-rgb),0.80) 0%, rgba(var(--coral-rgb),0.24) 100%)",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
            <div>
              <h3>Meilleures offres à ouvrir</h3>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Top 4 seulement ; le reste est dans le pipeline.</div>
            </div>
            <button className="btn btn-ghost" onClick={() => setView("pipeline")} style={{ fontSize: 12 }}>Ouvrir le pipeline <Icon name="arrow-right" size={12} /></button>
          </div>
          <div className="col gap-2">
            {queue.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12.5, color: "var(--ink-3)", borderRadius: 8, border: `1px solid ${warmBorder}`, background: warmSurface }}>
                Lancez un scan pour remplir cette liste.
              </div>
            ) : queue.map(lead => <LeadRow key={lead.job_id} lead={lead} openDrawer={openDrawer} />)}
          </div>
        </div>

        <div style={{
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${warmBorder}`,
          background: "linear-gradient(180deg, rgba(var(--white-rgb),0.76) 0%, rgba(var(--purplesoft-rgb),0.30) 100%)",
          boxShadow: "var(--shadow-sm)",
        }}>
          <h3>Maintenance</h3>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2, marginBottom: 12 }}>
            À utiliser quand les données semblent obsolètes.
          </div>
          <div className="col gap-2">
            {reevaluating ? (
              <SecondaryButton danger onClick={onStopReevaluate}>
                <Icon name="x" size={13} /> Arrêter le re-score
              </SecondaryButton>
            ) : (
              <SecondaryButton onClick={onReevaluate} disabled={scanning || leads.length === 0}>
                <Icon name="pulse" size={13} /> Re-scorer les offres
              </SecondaryButton>
            )}
            <SecondaryButton onClick={requestCleanup} disabled={busy || leads.length === 0} danger={cleanupConfirm}>
              <Icon name="trash" size={13} /> {cleaning ? "Nettoyage..." : cleanupConfirm ? "Confirmer le nettoyage" : "Nettoyer les données"}
            </SecondaryButton>
            {cleanupConfirm && (
              <div style={{ padding: 10, borderRadius: 8, border: "1px solid var(--yellow)", background: "var(--yellow-soft)", color: "var(--yellow-ink)", fontSize: 12, lineHeight: 1.45 }}>
                Les lignes hors sujet seront masquées, pas supprimées. Cliquez à nouveau pour confirmer.
                <button className="btn btn-ghost" onClick={() => setCleanupConfirm(false)} style={{ marginTop: 8, minHeight: 28, padding: "4px 8px", color: "inherit" }}>
                  Annuler
                </button>
              </div>
            )}
            <button className="btn btn-ghost" onClick={() => setView("activity")} style={{ justifyContent: "center", fontSize: 12 }}>
              Journal d'activité <Icon name="arrow-right" size={12} />
            </button>
          </div>
          {dueFollowups.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${warmBorder}` }}>
              <div className="eyebrow">Relances à faire</div>
              <div className="display tabular" style={{ fontSize: 28, color: "var(--green-ink)", marginTop: 4 }}>{dueFollowups.length}</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
