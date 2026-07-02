import { useEffect, useRef, useState } from "react";
import Icon from "../../shared/components/Icon";
import { AutomationSettings } from "./panels/AutomationSettings";
import { DiscoverySettings } from "./panels/DiscoverySettings";
import { GlobalSettings } from "./panels/GlobalSettings";
import { ResumeTemplatesPanel } from "./panels/ResumeTemplatesPanel";
import { StepSettings } from "./panels/StepSettings";
import { openUrl } from "@tauri-apps/plugin-opener";
import { EMPTY, KEY_FIELD, SECRET_MASKS, isSubscriptionProvider, type Cfg } from "./panels/config";
import { SecretInput } from "./panels/shared";
import { SectionLabel } from "./panels/shared";
import { useTheme, type ThemePref } from "../../shared/lib/theme";
import { readJsonResponse, responseErrorMessage } from "../../shared/lib/httpError";
import { settingsApi } from "../../api/settings";
import type { ApiFetch } from "../../types";

const LEGAL_BASE = "https://github.com/ValMtp3/Juste-Recrute-Moi/blob/main/docs/legal";
const LEGAL_LINKS: { label: string; href: string }[] = [
  { label: "Conditions d'utilisation", href: `${LEGAL_BASE}/terms-of-use.md` },
  { label: "Politique de confidentialité", href: `${LEGAL_BASE}/privacy-policy.md` },
];

function LegalSettings() {
  const [legalError, setLegalError] = useState<string | null>(null);
  const openLegalLink = async (href: string) => {
    try {
      setLegalError(null);
      await openUrl(href);
    } catch (error: unknown) {
      console.error("Ouverture du lien légal échouée :", error);
      setLegalError(readableSettingsError(error, "Le lien légal n'a pas pu être ouvert. Réessayez depuis GitHub."));
    }
  };

  return (
    <div>
      <SectionLabel label="Légal & confidentialité" sub="Juste Recrute Moi est local-first : vos données restent sur cet appareil" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {LEGAL_LINKS.map(l => (
          <button key={l.href} className="btn ghost" onClick={() => { void openLegalLink(l.href); }}
            style={{ fontSize: 12, padding: "7px 11px" }}>
            <Icon name="external" size={12} /> {l.label}
          </button>
        ))}
      </div>
      {legalError && (
        <div role="alert" style={{ marginTop: 8, color: "var(--bad)", fontSize: 12, lineHeight: 1.45 }}>
          {legalError}
        </div>
      )}
    </div>
  );
}

interface Props { api: ApiFetch; onClose: () => void; }

function readableSettingsError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("backend local")) {
    return "Backend local injoignable. Vérifiez que l'app est bien démarrée, puis réessayez.";
  }
  if (lower.includes("réinitialisation")) {
    return "La réinitialisation n'a pas pu être lancée. Vérifiez Activité, puis réessayez.";
  }
  if (lower.includes("reconstruction") || lower.includes("vecteur")) {
    return "La reconstruction des vecteurs a échoué. Vérifiez le runtime embeddings et réessayez.";
  }
  if (lower.includes("notification") || lower.includes("permission")) {
    return fallback;
  }
  if (lower.includes("failed to open") || lower.includes("could not open") || lower.includes("opener") || lower.includes("url")) {
    return fallback;
  }
  if (lower.includes("paramètres") || lower.includes("settings")) {
    return fallback;
  }
  return trimmed;
}

async function parseVectorRebuildSummary(response: Response) {
  const data = await readJsonResponse(
    response,
    "Réponse de reconstruction illisible. Relancez Juste Recrute Moi puis réessayez.",
  );
  const summary = data && typeof data === "object" ? (data as { summary?: unknown }).summary : null;
  const summaryRecord = summary && typeof summary === "object" ? summary as { vectors_dropped?: unknown; sync?: unknown } : {};
  const sync = summaryRecord.sync && typeof summaryRecord.sync === "object" ? summaryRecord.sync as { synced?: unknown } : {};
  const dropped = Array.isArray(summaryRecord.vectors_dropped) ? summaryRecord.vectors_dropped.length : 0;
  const synced = typeof sync.synced === "number" ? sync.synced : 0;
  return { dropped, synced };
}

async function parseBackupImportSummary(response: Response) {
  const data = await readJsonResponse(
    response,
    "Réponse de restauration illisible. Relancez Juste Recrute Moi puis réessayez.",
  );
  const summary = data && typeof data === "object" ? (data as { summary?: unknown }).summary : null;
  const summaryRecord = summary && typeof summary === "object" ? summary as { files_restored?: unknown } : {};
  const restored = typeof summaryRecord.files_restored === "number" ? summaryRecord.files_restored : 0;
  return { restored };
}

function backupFilename(response: Response) {
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || "juste-recrute-moi-backup.zip";
}

const THEME_OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: "light", label: "Clair", icon: "sun" },
  { value: "dark", label: "Sombre", icon: "moon" },
  { value: "system", label: "Système", icon: "globe" },
];

function AppearanceSettings() {
  const { pref, setPref } = useTheme();
  return (
    <div>
      <SectionLabel label="Apparence" sub="thème utilisé dans l'app : Système suit votre OS" />
      <div style={{ display: "flex", gap: 8 }}>
        {THEME_OPTIONS.map(opt => {
          const active = pref === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setPref(opt.value)}
              aria-pressed={active}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 12px", borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: active ? "var(--accent-soft)" : "var(--paper-2)",
                color: active ? "var(--accent)" : "var(--ink-2)",
                border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                transition: "background 140ms ease, border-color 140ms ease, color 140ms ease",
              }}
            >
              <Icon name={opt.icon} size={15} /> {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const EMBEDDING_OPTIONS = [
  { value: "onnx", label: "Local", sub: "MiniLM, hors ligne" },
  { value: "openai", label: "OpenAI API", sub: "text-embedding-3-small" },
  { value: "hash", label: "Secours", sub: "léger, non sémantique" },
];

function EmbeddingSettings({ cfg, onChange, api }: { cfg: Cfg; onChange: (k: keyof Cfg, v: string) => void; api: ApiFetch }) {
  const provider = cfg.embedding_provider || "onnx";

  return (
    <div>
      <SectionLabel label="Embeddings" sub="indépendant du fournisseur de chat : utilisé pour le matching sémantique" />
      <div style={{ padding: 16, borderRadius: 14, background: "var(--paper-2)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {EMBEDDING_OPTIONS.map(opt => {
            const active = provider === opt.value;
            return (
              <button key={opt.value} type="button" onClick={() => onChange("embedding_provider", opt.value)}
                aria-pressed={active}
                style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                  background: active ? "var(--accent-soft)" : "var(--card)",
                  color: active ? "var(--accent)" : "var(--ink-2)",
                }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: active ? "var(--accent)" : "var(--ink-3)", marginTop: 2 }}>{opt.sub}</div>
              </button>
            );
          })}
        </div>
        {provider === "openai" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>Clé OpenAI embeddings</div>
            <SecretInput value={cfg.embedding_openai_api_key}
              onChange={v => onChange("embedding_openai_api_key", v)}
              api={api}
              secretKey="embedding_openai_api_key"
              placeholder="sk-..."
            />
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
              Le chat peut rester sur un fournisseur personnalisé. Cette clé sert seulement à générer les vecteurs avec text-embedding-3-small.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function isConfigured(value: string | undefined) {
  const trimmed = String(value || "").trim();
  return Boolean(trimmed) || SECRET_MASKS.has(trimmed);
}

function SettingsReadiness({ cfg }: { cfg: Cfg }) {
  const provider = cfg.llm_provider || "ollama";
  const keyField = KEY_FIELD[provider];
  const llmReady = provider === "ollama" || isSubscriptionProvider(provider) || (keyField ? isConfigured(cfg[keyField] as string) : false);
  const targetReady = isConfigured(cfg.desired_position) || isConfigured(cfg.onboarding_target_role);
  const sourceReady = cfg.free_sources_enabled !== "false" && (
    isConfigured(cfg.job_boards) ||
    isConfigured(cfg.free_source_targets) ||
    cfg.job_market_focus === "france"
  );
  const volumeReady = Number(cfg.free_source_max_requests || 0) >= 10 && cfg.browser_scan_enabled !== "false";
  const items = [
    {
      label: "IA",
      ok: llmReady,
      detail: llmReady ? `Fournisseur ${provider}` : "Ajoutez une clé ou choisissez Ollama / abonnement CLI.",
    },
    {
      label: "Cible",
      ok: targetReady,
      detail: targetReady ? "Poste recherché renseigné" : "Ajoutez un rôle ou intitulé cible.",
    },
    {
      label: "Sources",
      ok: sourceReady,
      detail: sourceReady ? "Recherche gratuite active" : "Active les sources gratuites ou ajoute un preset.",
    },
    {
      label: "Volume",
      ok: volumeReady,
      detail: volumeReady ? "Scan navigateur et budget corrects" : "Active le scan navigateur ou augmente les requêtes.",
    },
  ];

  return (
    <div>
      <SectionLabel label="État de configuration" sub="ce qui influence directement la qualité des résultats" />
      <div className="settings-readiness-grid">
        {items.map(item => (
          <div key={item.label} className={"settings-readiness-card " + (item.ok ? "ok" : "warn")}>
            <div className="settings-readiness-head">
              <span>{item.label}</span>
              <span className="mono">{item.ok ? "prêt" : "à faire"}</span>
            </div>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DangerZone({ api }: { api: ApiFetch }) {
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importConfirm, setImportConfirm] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [clearSettings, setClearSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vectorOpen, setVectorOpen] = useState(false);
  const [vectorConfirm, setVectorConfirm] = useState("");
  const [vectorBusy, setVectorBusy] = useState(false);
  const [vectorResult, setVectorResult] = useState<string | null>(null);
  const [vectorError, setVectorError] = useState<string | null>(null);

  const armed = confirmText.trim().toUpperCase() === "DELETE";
  const importArmed = importConfirm.trim().toUpperCase() === "IMPORT" && Boolean(importFile);
  const vectorsArmed = vectorConfirm.trim().toUpperCase() === "VECTORS";

  const exportData = async () => {
    setExportBusy(true);
    setExportError(null);
    setExportResult(null);
    try {
      const response = await settingsApi.exportData(api);
      if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "L'export des données a échoué"));
      }
      const blob = await response.blob();
      if (!blob.size) {
        throw new Error("Archive de sauvegarde vide");
      }
      const filename = backupFilename(response);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportResult(`Sauvegarde téléchargée : ${filename}`);
    } catch (e) {
      setExportError(readableSettingsError(e, "L'export des données a échoué"));
    } finally {
      setExportBusy(false);
    }
  };

  const importData = async () => {
    if (!importFile || !importArmed) return;
    setImportBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      const response = await settingsApi.importData(api, importFile);
      if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "La restauration de la sauvegarde a échoué"));
      }
      const { restored } = await parseBackupImportSummary(response);
      setImportResult(`${restored} fichier(s) restauré(s). Rechargement...`);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      setImportError(readableSettingsError(e, "La restauration de la sauvegarde a échoué"));
      setImportBusy(false);
    }
  };

  const reset = async () => {
    if (!armed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await settingsApi.resetData(api, { clearSettings });
      if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "Réinitialisation échouée"));
      }
      // Reload so every view re-fetches the now-empty data and returns to a clean
      // first-run state.
      window.location.reload();
    } catch (e) {
      setError(readableSettingsError(e, "Réinitialisation échouée"));
      setBusy(false);
    }
  };

  const rebuildVectors = async () => {
    if (!vectorsArmed) return;
    setVectorBusy(true);
    setVectorError(null);
    setVectorResult(null);
    try {
      const response = await settingsApi.rebuildVectors(api);
      if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "Reconstruction des vecteurs échouée"));
      }
      const { dropped, synced } = await parseVectorRebuildSummary(response);
      setVectorResult(`${dropped} table(s) supprimée(s), ${synced} vecteur(s) resynchronisé(s).`);
      setVectorOpen(false);
      setVectorConfirm("");
    } catch (e) {
      setVectorError(readableSettingsError(e, "Reconstruction des vecteurs échouée"));
    } finally {
      setVectorBusy(false);
    }
  };

  return (
    <div>
      <SectionLabel label="Zone dangereuse" sub="Effacez les données locales pour repartir à zéro : action irréversible" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ border: "1px solid var(--line)", background: "var(--paper-2)", borderRadius: 12, padding: 14 }}>
        {!importOpen ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", maxWidth: 460 }}>
              Exporte une archive complète : réglages, clés API locales, profil, CV/LinkedIn, expériences, offres, scores, suivi, graphe, vecteurs et documents générés.
              {exportResult && <div style={{ marginTop: 6, color: "var(--green-ink)", fontWeight: 700 }}>{exportResult}</div>}
              {importResult && <div style={{ marginTop: 6, color: "var(--green-ink)", fontWeight: 700 }}>{importResult}</div>}
              {exportError && <div style={{ marginTop: 6, color: "var(--bad)", fontWeight: 700 }}>{exportError}</div>}
              {importError && <div style={{ marginTop: 6, color: "var(--bad)", fontWeight: 700 }}>{importError}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn" onClick={exportData} disabled={exportBusy}
                style={{ fontSize: 13, padding: "8px 16px", whiteSpace: "nowrap", opacity: exportBusy ? 0.65 : 1 }}>
                <Icon name="download" size={13} /> {exportBusy ? "Export..." : "Exporter les données"}
              </button>
              <button className="btn" onClick={() => { setImportOpen(true); setImportError(null); setImportResult(null); }}
                style={{ fontSize: 13, padding: "8px 16px", whiteSpace: "nowrap" }}>
                <Icon name="upload" size={13} /> Importer une sauvegarde
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
              <Icon name="alert" size={13} /> La restauration remplace les réglages, clés API, profil, offres, scores, suivi et fichiers locaux actuels par le contenu de l'archive. Exportez d'abord une sauvegarde si vous voulez garder l'état actuel.
            </div>
            <input ref={backupInputRef} type="file" accept=".zip,application/zip"
              onChange={e => { setImportFile(e.target.files?.[0] || null); setImportError(null); }} />
            <input type="text" value={importConfirm} onChange={e => setImportConfirm(e.target.value)}
              placeholder="Tapez IMPORT pour confirmer" className="field-input" style={{ fontSize: 13 }} />
            {importFile && <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Archive sélectionnée : {importFile.name}</div>}
            {importError && <div style={{ color: "var(--bad)", fontSize: 12, fontWeight: 700 }}>{importError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" disabled={importBusy}
                onClick={() => {
                  setImportOpen(false); setImportConfirm(""); setImportFile(null); setImportError(null);
                  if (backupInputRef.current) backupInputRef.current.value = "";
                }}
                style={{ fontSize: 13, padding: "8px 16px" }}>Annuler</button>
              <button className="btn" onClick={importData} disabled={importBusy || !importArmed}
                style={{ background: "var(--bad)", color: "#fff", borderColor: "var(--bad)", fontSize: 13, padding: "8px 18px", opacity: (importBusy || !importArmed) ? 0.55 : 1 }}>
                <Icon name="upload" size={13} /> {importBusy ? "Restauration..." : "Restaurer"}
              </button>
            </div>
          </div>
        )}
      </div>
      <div style={{ border: "1px solid var(--yellow)", background: "var(--yellow-soft)", borderRadius: 12, padding: 14 }}>
        {!vectorOpen ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", maxWidth: 460 }}>
              Supprime seulement les tables vectorielles et les reconstruit depuis le graphe. À utiliser après un changement de provider embeddings.
              {vectorResult && <div style={{ marginTop: 6, color: "var(--green-ink)", fontWeight: 700 }}>{vectorResult}</div>}
              {vectorError && <div style={{ marginTop: 6, color: "var(--bad)", fontWeight: 700 }}>{vectorError}</div>}
            </div>
            <button className="btn" onClick={() => { setVectorOpen(true); setVectorResult(null); setVectorError(null); }}
              style={{ color: "var(--yellow-ink)", borderColor: "var(--yellow)", fontSize: 13, padding: "8px 16px", whiteSpace: "nowrap" }}>
              <Icon name="graph" size={13} /> Reconstruire les vecteurs
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
              <Icon name="alert" size={13} /> Cette action recrée les embeddings locaux sans supprimer les offres, le profil ni les paramètres. Tapez <b>VECTORS</b> pour confirmer.
            </div>
            <input type="text" value={vectorConfirm} onChange={e => setVectorConfirm(e.target.value)}
              placeholder="Tapez VECTORS pour confirmer" className="field-input" style={{ fontSize: 13 }} />
            {vectorError && <div style={{ color: "var(--bad)", fontSize: 12, fontWeight: 700 }}>{vectorError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" disabled={vectorBusy}
                onClick={() => { setVectorOpen(false); setVectorConfirm(""); setVectorError(null); }}
                style={{ fontSize: 13, padding: "8px 16px" }}>Annuler</button>
              <button className="btn" onClick={rebuildVectors} disabled={vectorBusy || !vectorsArmed}
                style={{ background: "var(--yellow)", color: "var(--yellow-ink)", borderColor: "var(--yellow)", fontSize: 13, padding: "8px 18px", opacity: (vectorBusy || !vectorsArmed) ? 0.55 : 1 }}>
                <Icon name="graph" size={13} /> {vectorBusy ? "Reconstruction..." : "Reconstruire"}
              </button>
            </div>
          </div>
        )}
      </div>
      <div style={{ border: "1px solid var(--bad)", background: "var(--bad-soft, rgba(220,38,38,0.06))", borderRadius: 12, padding: 14 }}>
        {!open ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", maxWidth: 460 }}>
              Supprime toutes les offres, votre profil (graphe + vecteurs) et les documents générés sur cet appareil. Les paramètres et clés fournisseur sont conservés.
            </div>
            <button className="btn" onClick={() => setOpen(true)}
              style={{ color: "var(--bad)", borderColor: "var(--bad)", fontSize: 13, padding: "8px 16px", whiteSpace: "nowrap" }}>
              <Icon name="trash" size={13} /> Tout supprimer
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
              <Icon name="alert" size={13} /> Cette action supprime définitivement toutes les offres, votre profil (graphe + vecteurs) et les PDF générés sur cet appareil. Tapez <b>DELETE</b> pour confirmer.
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-2)", cursor: "pointer" }}>
              <input type="checkbox" checked={clearSettings} onChange={e => setClearSettings(e.target.checked)} />
              Réinitialiser aussi les paramètres et fournisseurs
            </label>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder="Tapez DELETE pour confirmer" autoFocus className="field-input" style={{ fontSize: 13 }} />
            {error && <div style={{ color: "var(--bad)", fontSize: 12, fontWeight: 700 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" disabled={busy}
                onClick={() => { setOpen(false); setConfirmText(""); setError(null); setClearSettings(false); }}
                style={{ fontSize: 13, padding: "8px 16px" }}>Annuler</button>
              <button className="btn" onClick={reset} disabled={busy || !armed}
                style={{ background: "var(--bad)", color: "#fff", borderColor: "var(--bad)", fontSize: 13, padding: "8px 18px", opacity: (busy || !armed) ? 0.55 : 1 }}>
                <Icon name="trash" size={13} /> {busy ? "Suppression..." : clearSettings ? "Tout supprimer" : "Supprimer les données"}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default function SettingsModal({ api, onClose }: Props) {
  const [cfg, setCfg]       = useState<Cfg>(EMPTY);
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
  }, []);

  useEffect(() => {
    setLoadingCfg(true);
    setLoadError(null);
    api("/api/v1/settings")
      .then(async r => {
        if (!r.ok) throw new Error(await responseErrorMessage(r, `Le serveur a renvoyé ${r.status}`));
        return readJsonResponse<Partial<Cfg>>(
          r,
          "Les paramètres ont répondu dans un format illisible. Rechargez l'application puis réessayez.",
        );
      })
      .then(d => setCfg(c => ({ ...c, ...d })))
      .catch(error => setLoadError(readableSettingsError(error, "Les paramètres n'ont pas pu être chargés")))
      .finally(() => setLoadingCfg(false));
  }, [api]);

  const set = (k: keyof Cfg) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setCfg(c => ({ ...c, [k]: e.target.value }));

  const onChange = (k: keyof Cfg, v: string) => setCfg(c => ({ ...c, [k]: v }));

  const save = async () => {
    if (loadingCfg || loadError) return;
    setSaving(true);
    setSaveError(null);
    setSaveWarning(null);
    try {
      const response = await api("/api/v1/settings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
      });
      if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "Les paramètres n'ont pas pu être enregistrés"));
      }
      if (cfg.x_enable_notifications === "true" && "Notification" in window && Notification.permission === "default") {
        try {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            setSaveWarning("Paramètres enregistrés, mais les notifications ne sont pas autorisées sur cet appareil.");
          }
        } catch (notificationError: unknown) {
          console.error("Permission notification refusée :", notificationError);
          setSaveWarning(readableSettingsError(notificationError, "Paramètres enregistrés, mais la permission notification n'a pas pu être demandée."));
        }
      }
      setSaved(true);
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(readableSettingsError(error, "Les paramètres n'ont pas pu être enregistrés"));
    } finally { setSaving(false); }
  };

  const prov = cfg.llm_provider || "ollama";

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} style={{ zIndex: 100 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(720px, 94vw)", maxHeight: "90vh", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 22, boxShadow: "var(--shadow-lg)", zIndex: 101, overflow: "hidden", display: "flex", flexDirection: "column", animation: "slide-up .3s ease" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--line)", background: "var(--blue-soft)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div className="eyebrow">Configuration</div>
            <h2 style={{ fontSize: 26, marginTop: 2 }}>Paramètres</h2>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 3 }}>Configure les clés locales, seuils de scraping, scoring et modèles d'adaptation</div>
          </div>
          <button className="btn btn-icon" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>

        <div className="scroll" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
          {(loadingCfg || loadError) && (
            <div style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${loadError ? "var(--bad)" : "var(--line)"}`,
              background: loadError ? "var(--bad-soft)" : "var(--paper-2)",
              color: loadError ? "var(--bad)" : "var(--ink-2)",
              fontSize: 12,
              fontWeight: 700,
            }}>
              {loadError || "Chargement des paramètres..."}
            </div>
          )}
          <AppearanceSettings />
          <SettingsReadiness cfg={cfg} />
          <GlobalSettings cfg={cfg} set={set} onChange={onChange} prov={prov} api={api} />
          <EmbeddingSettings cfg={cfg} onChange={onChange} api={api} />
          <ResumeTemplatesPanel api={api} />
          <StepSettings cfg={cfg} onChange={onChange} api={api} />
          <DiscoverySettings cfg={cfg} set={set} onChange={onChange} api={api} />
          <AutomationSettings cfg={cfg} onChange={onChange} />
          <LegalSettings />
          <DangerZone api={api} />
          <div style={{ height: 6 }} />
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--line)", background: "var(--paper-2)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {saveError && <div style={{ marginRight: "auto", alignSelf: "center", color: "var(--bad)", fontSize: 12, fontWeight: 700 }}>{saveError}</div>}
          {!saveError && saveWarning && <div style={{ marginRight: "auto", alignSelf: "center", color: "var(--yellow-ink)", fontSize: 12, fontWeight: 700 }}>{saveWarning}</div>}
          <button className="btn" onClick={onClose} style={{ padding: "9px 20px", fontSize: 13, borderRadius: 10 }}>Annuler</button>
          <button className="btn btn-accent" onClick={save} disabled={saving || loadingCfg || Boolean(loadError)} style={{ padding: "9px 26px", fontSize: 13, borderRadius: 10, minWidth: 110 }}>
            {loadError ? "Chargement requis" : loadingCfg ? "Chargement..." : saved ? "Enregistré" : saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </>
  );
}
