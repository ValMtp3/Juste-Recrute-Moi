import { useEffect, useState } from "react";
import Icon from "../../shared/components/Icon";
import { AutomationSettings } from "./panels/AutomationSettings";
import { DiscoverySettings } from "./panels/DiscoverySettings";
import { GlobalSettings } from "./panels/GlobalSettings";
import { ResumeTemplatesPanel } from "./panels/ResumeTemplatesPanel";
import { StepSettings } from "./panels/StepSettings";
import { openUrl } from "@tauri-apps/plugin-opener";
import { EMPTY, SecretInput, type Cfg } from "./panels/shared";
import { SectionLabel } from "./panels/shared";
import { useTheme, type ThemePref } from "../../shared/lib/theme";
import { settingsApi } from "../../api/settings";
import type { ApiFetch } from "../../types";

const LEGAL_BASE = "https://github.com/ValMtp3/Juste-Recrute-Moi/blob/main/docs/legal";
const LEGAL_LINKS: { label: string; href: string }[] = [
  { label: "Conditions d'utilisation", href: `${LEGAL_BASE}/terms-of-use.md` },
  { label: "Politique de confidentialité", href: `${LEGAL_BASE}/privacy-policy.md` },
];

function LegalSettings() {
  return (
    <div>
      <SectionLabel label="Légal & confidentialité" sub="Juste Recrute Moi est local-first : tes données restent sur cet appareil" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {LEGAL_LINKS.map(l => (
          <button key={l.href} className="btn ghost" onClick={() => openUrl(l.href)}
            style={{ fontSize: 12, padding: "7px 11px" }}>
            <Icon name="external" size={12} /> {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props { api: ApiFetch; onClose: () => void; }

const THEME_OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: "light", label: "Clair", icon: "sun" },
  { value: "dark", label: "Sombre", icon: "moon" },
  { value: "system", label: "Système", icon: "globe" },
];

function AppearanceSettings() {
  const { pref, setPref } = useTheme();
  return (
    <div>
      <SectionLabel label="Apparence" sub="thème utilisé dans l'app : Système suit ton OS" />
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
  { value: "hash", label: "Fallback", sub: "léger, non sémantique" },
];

function EmbeddingSettings({ cfg, onChange, api }: { cfg: Cfg; onChange: (k: keyof Cfg, v: string) => void; api: ApiFetch }) {
  const provider = cfg.embedding_provider || "onnx";

  return (
    <div>
      <SectionLabel label="Embeddings" sub="indépendant du provider chat : utilisé pour le matching sémantique" />
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
              Le chat peut rester sur Custom. Cette clé sert seulement à générer les vecteurs avec text-embedding-3-small.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DangerZone({ api }: { api: ApiFetch }) {
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
  const vectorsArmed = vectorConfirm.trim().toUpperCase() === "VECTORS";

  const reset = async () => {
    if (!armed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await settingsApi.resetData(api, { clearSettings });
      if (!response.ok) {
        const detail = await response.json().then(d => d.detail).catch(() => "");
        throw new Error(detail || "Réinitialisation échouée");
      }
      // Reload so every view re-fetches the now-empty data and returns to a clean
      // first-run state.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Reconstruction des vecteurs échouée");
      }
      const dropped = Array.isArray(data.summary?.vectors_dropped) ? data.summary.vectors_dropped.length : 0;
      const synced = data.summary?.sync?.synced ?? 0;
      setVectorResult(`${dropped} table(s) supprimée(s), ${synced} vecteur(s) resynchronisé(s).`);
      setVectorOpen(false);
      setVectorConfirm("");
    } catch (e) {
      setVectorError(e instanceof Error ? e.message : String(e));
    } finally {
      setVectorBusy(false);
    }
  };

  return (
    <div>
      <SectionLabel label="Zone dangereuse" sub="Efface les données locales pour repartir à zéro : action irréversible" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
              <Icon name="alert" size={13} /> Cette action recrée les embeddings locaux sans supprimer les offres, le profil ni les paramètres. Tape <b>VECTORS</b> pour confirmer.
            </div>
            <input type="text" value={vectorConfirm} onChange={e => setVectorConfirm(e.target.value)}
              placeholder="Tape VECTORS pour confirmer" className="field-input" style={{ fontSize: 13 }} />
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
              Supprime toutes les offres, ton profil (graphe + vecteurs) et les documents générés sur cet appareil. Les paramètres et clés fournisseur sont conservés.
            </div>
            <button className="btn" onClick={() => setOpen(true)}
              style={{ color: "var(--bad)", borderColor: "var(--bad)", fontSize: 13, padding: "8px 16px", whiteSpace: "nowrap" }}>
              <Icon name="trash" size={13} /> Tout supprimer
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
              <Icon name="alert" size={13} /> Cette action supprime définitivement toutes les offres, ton profil (graphe + vecteurs) et les PDF générés sur cet appareil. Tape <b>DELETE</b> pour confirmer.
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-2)", cursor: "pointer" }}>
              <input type="checkbox" checked={clearSettings} onChange={e => setClearSettings(e.target.checked)} />
              Réinitialiser aussi les paramètres et fournisseurs
            </label>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder="Tape DELETE pour confirmer" autoFocus className="field-input" style={{ fontSize: 13 }} />
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    api("/api/v1/settings")
      .then(r => r.json())
      .then(d => setCfg(c => ({ ...c, ...d })))
      .catch(() => {});
  }, [api]);

  const set = (k: keyof Cfg) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setCfg(c => ({ ...c, [k]: e.target.value }));

  const onChange = (k: keyof Cfg, v: string) => setCfg(c => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await api("/api/v1/settings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
      });
      if (!response.ok) {
        const detail = await response.json().then(data => data.detail).catch(() => "");
        throw new Error(detail || "Les paramètres n'ont pas pu être enregistrés");
      }
      if (cfg.x_enable_notifications === "true" && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
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
          <AppearanceSettings />
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
          <button className="btn" onClick={onClose} style={{ padding: "9px 20px", fontSize: 13, borderRadius: 10 }}>Annuler</button>
          <button className="btn btn-accent" onClick={save} disabled={saving} style={{ padding: "9px 26px", fontSize: 13, borderRadius: 10, minWidth: 110 }}>
            {saved ? "Enregistré" : saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </>
  );
}
