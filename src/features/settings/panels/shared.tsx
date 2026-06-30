import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../../shared/components/Icon";
import { settingsApi } from "../../../api/settings";
import type { ApiFetch } from "../../../types";
import { MODEL_HINTS, PROVIDERS, SECRET_MASKS, isSubscriptionProvider, type CatalogRow, type Cfg, type StepConfig, type SubStatus } from "./config";
import { readJsonResponse, responseErrorMessage } from "../../../shared/lib/httpError";
const SECRET_DISPLAY_MASK = "••••••••••••••••";

/* helpers */
export function LabelledField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function SectionLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
      {sub && <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{sub}</span>}
    </div>
  );
}

export function ProviderPills({ value, onChange, small }: { value: string; onChange: (v: string) => void; small?: boolean }) {
  return (
    <div style={{ display: "flex", gap: small ? 5 : 7, flexWrap: "wrap" }}>
      {PROVIDERS.map(p => {
        const active = value === p.id;
        return (
          <button key={p.id} onClick={() => onChange(p.id)} style={{
            padding: small ? "5px 10px" : "10px 12px", borderRadius: small ? 8 : 11, cursor: "pointer",
            background: active ? `var(--${p.tone}-soft)` : "var(--card)",
            border: `1.5px solid ${active ? `var(--${p.tone})` : "var(--line)"}`,
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: small ? 2 : 5, transition: "all .15s ease", minWidth: small ? 0 : 78,
          }}>
            <div style={{ fontSize: small ? 12 : 13, fontWeight: 600, color: active ? `var(--${p.tone}-ink)` : "var(--ink-2)" }}>
              {p.label}
            </div>
            {!small && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-3)" }}>{p.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}

function fmtCtx(n?: number | null): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}
function fmtMeta(c?: CatalogRow): string {
  if (!c) return "";
  const parts: string[] = [];
  const ctx = fmtCtx(c.context);
  if (ctx) parts.push(`${ctx} ctx`);
  if (c.input != null || c.output != null) parts.push(`$${c.input ?? "?"}/$${c.output ?? "?"}`);
  if (c.reasoning) parts.push("reasoning");
  if (c.release_date) parts.push(c.release_date.slice(0, 7));
  return parts.join("  ·  ");
}

function readableSettingsPanelError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("backend local")) {
    return "Backend local injoignable. Vérifiez que l'app est bien démarrée, puis réessayez.";
  }
  if (lower.includes("catalogue") || lower.includes("model")) return fallback;
  if (lower.includes("unknown secret") || lower.includes("secret inconnu")) {
    return "Secret inconnu. Rechargez les réglages puis réessayez.";
  }
  if (lower.includes("secret not configured") || lower.includes("aucun secret")) {
    return "Aucun secret n'est enregistré pour ce champ.";
  }
  if (lower.includes("secret")) return fallback;
  return trimmed;
}

/**
 * Model picker backed by the always-current models.dev catalog (fetched live and
 * cached server-side, with an offline snapshot) plus whatever the user's own key
 * can actually reach. It auto-loads the moment a provider is chosen — no button —
 * is searchable (providers like OpenRouter list hundreds), shows context/price/
 * date metadata, and is ALWAYS free-form: type any model id, even one neither the
 * catalog nor your key knows yet. `MODEL_HINTS` is only an offline fallback now.
 */
export function ModelChips({ provider, value, onChange, api, cfg }: {
  provider: string; value: string; onChange: (v: string) => void; api?: ApiFetch | null; cfg?: Cfg;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const requestRef = useRef(0);

  const reload = useCallback(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (!api || !provider || isSubscriptionProvider(provider) || provider === "ollama") {
      setModels([]); setCatalog([]); setLoadError(""); return;
    }
    setLoading(true);
    setLoadError("");
    settingsApi.models(api, provider, cfg || {})
      .then(async r => {
        if (!r.ok) {
          throw new Error(await responseErrorMessage(r, `Catalogue indisponible (${r.status})`));
        }
        return readJsonResponse<Record<string, unknown>>(
          r,
          "Catalogue modèles illisible. Saisissez l'id du modèle manuellement ou réessayez.",
        );
      })
      .then(d => {
        if (requestRef.current !== requestId) return;
        setModels(Array.isArray(d.models) ? d.models : []);
        setCatalog(Array.isArray(d.catalog) ? d.catalog : []);
      })
      .catch(err => {
        if (requestRef.current !== requestId) return;
        setModels([]);
        setCatalog([]);
        const message = readableSettingsPanelError(err, "Catalogue modèles indisponible.");
        setLoadError(`${message} Saisissez l'id du modèle manuellement ou réessayez après avoir enregistré la clé.`);
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
    // cfg intentionally excluded: reload on provider change, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, provider]);
  useEffect(() => { reload(); }, [reload]);

  const ids = models.length ? models : (MODEL_HINTS[provider] || []);
  const meta = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog]);
  const q = value.trim().toLowerCase();
  const exact = ids.some(m => m.toLowerCase() === q);
  const filtered = (q && !exact) ? ids.filter(m => m.toLowerCase().includes(q)) : ids;
  const shown = filtered.slice(0, 60);

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          placeholder={ids.length ? `Chercher parmi ${ids.length} modèles ou saisir un id...` : "Saisir un id de modèle..."}
          className="mono field-input"
          style={{ width: "100%", paddingRight: 70, fontSize: 12 }}
        />
        <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 6 }}>
          {loading
            ? <span className="spinner-sm" aria-hidden="true" />
            : ids.length > 0 && <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{ids.length}</span>}
          <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
            aria-label="Afficher ou masquer la liste des modèles" title="Parcourir les modèles"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)", padding: 0, fontSize: 11, lineHeight: 1 }}>
            {open ? "▴" : "▾"}
          </button>
        </div>
      </div>
      {loadError && <div style={{ color: "var(--bad)", fontSize: 11.5, lineHeight: 1.35 }}>{loadError}</div>}
      {!open && ids.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {ids.slice(0, 8).map(m => {
            const active = value === m;
            const label = m === "" ? "Défaut de l'abonnement" : (m.length > 28 ? `…${m.slice(-26)}` : m);
            return (
              <button key={m || "__default"} type="button" onClick={() => onChange(m)}
                title={m || "Utiliser le modèle par défaut de votre abonnement"}
                style={{
                  padding: "3px 10px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                  fontFamily: m === "" ? "inherit" : "var(--font-mono)",
                  background: active ? "var(--ink)" : "var(--paper-2)",
                  color: active ? "var(--paper)" : "var(--ink-2)",
                  border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                }}>
                {label}
              </button>
            );
          })}
          {ids.length > 8 && <span style={{ fontSize: 10.5, color: "var(--ink-3)", alignSelf: "center" }}>+{ids.length - 8} autres ; cherchez ci-dessus</span>}
        </div>
      )}
      {open && shown.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30,
          maxHeight: 300, overflowY: "auto", background: "var(--card)", border: "1px solid var(--line)",
          borderRadius: 10, boxShadow: "var(--shadow-md, 0 8px 28px rgba(0,0,0,0.14))", padding: 4,
        }}>
          {shown.map(m => {
            const c = meta.get(m);
            const metaText = fmtMeta(c);
            const active = value === m;
            return (
              <button key={m} type="button" onMouseDown={e => { e.preventDefault(); onChange(m); setOpen(false); }}
                style={{
                  width: "100%", textAlign: "left", border: "1px solid transparent", borderRadius: 7,
                  background: active ? "var(--paper-2)" : "transparent", cursor: "pointer",
                  padding: "7px 9px", display: "flex", flexDirection: "column", gap: 2,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--paper-2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? "var(--paper-2)" : "transparent"; }}>
                <span className={m === "" ? "" : "mono"} style={{ fontSize: 12, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m === "" ? "Défaut de l'abonnement" : m}</span>
                {metaText && <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{metaText}</span>}
              </button>
            );
          })}
          {filtered.length > shown.length && (
            <div style={{ fontSize: 10.5, color: "var(--ink-3)", padding: "6px 9px" }}>+{filtered.length - shown.length} autres ; continuez à taper pour filtrer</div>
          )}
        </div>
      )}
      {open && shown.length === 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30,
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10,
          boxShadow: "var(--shadow-md, 0 8px 28px rgba(0,0,0,0.14))", padding: 12,
          color: "var(--ink-3)", fontSize: 12, lineHeight: 1.45,
        }}>
          Aucun modèle ne correspond à cette recherche. Vous pouvez garder l'identifiant saisi si le fournisseur l'accepte.
        </div>
      )}
    </div>
  );
}

export function SecretInput({ value, onChange, placeholder, disabled = false, api, secretKey, ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  api?: ApiFetch | null;
  secretKey?: keyof Cfg;
  ariaLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState("");
  const masked = SECRET_MASKS.has(value);
  const displayValue = masked ? (visible ? (revealed || "Secret enregistré") : SECRET_DISPLAY_MASK) : value;

  const toggleVisible = async () => {
    const nextVisible = !visible;
    setVisible(nextVisible);
    setRevealError("");
    if (!nextVisible || !masked || revealed || !api || !secretKey) return;
    setRevealing(true);
    try {
      const response = await settingsApi.revealSecret(api, String(secretKey));
      if (response.ok) {
        const data = await readJsonResponse<{ value?: unknown }>(
          response,
          "Réponse de révélation illisible. Rechargez les réglages puis réessayez.",
        );
        setRevealed(typeof data.value === "string" ? data.value : "");
      } else {
        const message = await responseErrorMessage(response, `Le secret enregistré n'a pas pu être affiché (${response.status}).`);
        setRevealError(readableSettingsPanelError(message, "Le backend local n'a pas pu révéler ce secret."));
      }
    } catch (error) {
      setRevealError(readableSettingsPanelError(error, "Le backend local n'a pas pu révéler ce secret."));
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ position: "relative" }}>
        <input
          type={visible ? "text" : "password"}
          value={displayValue}
          onChange={e => { setRevealed(""); setRevealError(""); onChange(e.target.value); }}
          onFocus={e => {
            if (masked && !revealed) e.currentTarget.select();
          }}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="mono field-input"
          style={{
            width: "100%",
            padding: "9px 38px 9px 12px",
            borderRadius: 9,
            border: "1px solid var(--line)",
            background: disabled ? "var(--paper-3)" : "var(--card)",
            fontSize: 12,
            opacity: disabled ? 0.75 : 1,
            cursor: disabled ? "not-allowed" : "text",
          }}
        />
        <button
          type="button"
          onClick={toggleVisible}
          disabled={disabled || revealing}
          aria-label={visible ? "Masquer le secret" : "Afficher le secret"}
          title={visible ? "Masquer le secret" : "Afficher le secret"}
          style={{
            position: "absolute",
            right: 7,
            top: "50%",
            transform: "translateY(-50%)",
            width: 26,
            height: 26,
            border: "none",
            borderRadius: 7,
            display: "grid",
            placeItems: "center",
            background: "transparent",
            color: "var(--ink-3)",
            cursor: disabled || revealing ? "not-allowed" : "pointer",
          }}
        >
          {revealing ? <span className="spinner-sm" aria-hidden="true" /> : <Icon name={visible ? "eye-off" : "eye"} size={14} />}
        </button>
      </div>
      {(masked || revealError) && (
        <div style={{ color: revealError ? "var(--bad)" : "var(--ink-4)", fontSize: 10.8, lineHeight: 1.35 }}>
          {revealError || "Une clé est déjà enregistrée. Tapez une nouvelle valeur pour la remplacer."}
        </div>
      )}
    </div>
  );
}

export function ApiKeyInput({ value, onChange, provider, isStep, disabled = false, placeholder, api, secretKey }: {
  value: string; onChange: (v: string) => void; provider: string; isStep?: boolean; disabled?: boolean; placeholder?: string; api?: ApiFetch | null; secretKey?: keyof Cfg;
}) {
  if (provider === "ollama" || isSubscriptionProvider(provider)) return null;
  const ph: Record<string, string> = {
    anthropic: "sk-ant-****", gemini: "AIza****", groq: "gsk_****", nvidia: "nvapi-****",
    openai: "sk-****", deepseek: "sk-****", xai: "xai-****", kimi: "sk-****",
    mistral: "****", openrouter: "sk-or-****", together: "****", fireworks: "fw_****",
    cerebras: "csk-****", perplexity: "pplx-****", huggingface: "hf_****", cohere: "co_****",
    sambanova: "****", qwen: "sk-****", azure: "Clé Azure OpenAI", custom: "Clé API",
  };
  return (
    <SecretInput value={value} onChange={onChange} disabled={disabled} api={api} secretKey={secretKey}
      placeholder={placeholder || (isStep ? `Clé API pour ${provider}` : ph[provider] || "Clé API")}
    />
  );
}

function subBadge(tone: string, text: React.ReactNode) {
  const s = tone === "bad"
    ? { background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid var(--bad)" }
    : { background: `var(--${tone}-soft)`, color: `var(--${tone}-ink)`, border: `1px solid var(--${tone})` };
  return <span className="mono" style={{ alignSelf: "flex-start", fontSize: 10.5, padding: "3px 9px", borderRadius: 999, ...s }}>{text}</span>;
}

export function SubscriptionNote({ provider, status, onSignIn, busy }: {
  provider: string;
  status?: SubStatus;
  onSignIn?: () => void;
  busy?: boolean;
}) {
  const cli = ({ claude_cli: "claude", codex_cli: "codex", gemini_cli: "gemini", copilot_cli: "copilot" } as Record<string, string>)[provider] || provider;
  const plan = ({
    claude_cli: "Claude (Pro / Max)",
    codex_cli: "ChatGPT (Plus / Pro)",
    gemini_cli: "Google account / Gemini",
    copilot_cli: "GitHub Copilot",
  } as Record<string, string>)[provider] || "subscription";

  let inner: React.ReactNode;
  if (!status) {
    inner = subBadge("yellow", `Recherche du CLI ${cli}...`);
  } else if (!status.installed) {
    const h = status.install_hint;
    inner = (
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {subBadge("bad", `CLI ${cli} non installé`)}
        {h && <>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Installez-le, puis connectez-vous :</div>
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, background: "var(--paper-3)", border: "1px solid var(--line)", borderRadius: 7, padding: "6px 9px", userSelect: "all" }}>{h.cmd}</code>
          <a href={h.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--accent)" }}>guide d'installation ↗</a>
        </>}
      </div>
    );
  } else if (!status.logged_in) {
    inner = (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {subBadge("yellow", `CLI ${cli} trouvé ; non connecté`)}
        <button className="btn" onClick={onSignIn} disabled={busy} style={{ fontSize: 12 }}>
          {busy ? "Ouverture de la connexion..." : "Se connecter"}
        </button>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Le bouton ouvre une page de connexion vers votre compte {plan}</span>
      </div>
    );
  } else {
    inner = subBadge("green", `Connecté${status.email ? ` en tant que ${status.email}` : ""}${status.plan ? ` · offre ${status.plan}` : ""} ; prêt`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "11px 13px", borderRadius: 11, background: "var(--paper-2)", border: "1px solid var(--line)" }}>
      <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
        Cette option utilise l'abonnement <b>{plan}</b> via le CLI <span className="mono">{cli}</span> ; <b>aucune clé API</b>. L'automatisation reste locale et consomme votre offre, pas une facturation au token.
      </div>
      {inner}
    </div>
  );
}

export function StepCard({ step, cfg, onChange, api }: { step: StepConfig; cfg: Cfg; onChange: (k: keyof Cfg, v: string) => void; api?: ApiFetch | null }) {
  const provKey  = `${step.id}_provider` as keyof Cfg;
  const apiKey   = `${step.id}_api_key`  as keyof Cfg;
  const modelKey = `${step.id}_model`    as keyof Cfg;
  const isCustom = !!(cfg[provKey] as string);
  const stepProv = (cfg[provKey] as string) || cfg.llm_provider || "ollama";
  const [forceStepKey, setForceStepKey] = useState(false);
  const usesGlobalKey = stepProv !== "ollama" && !forceStepKey && !(cfg[apiKey] as string);
  const keySourceLabel = stepProv === cfg.llm_provider
    ? `Utiliser la clé API globale ${stepProv}`
    : `Utiliser la clé API ${stepProv} enregistrée`;
  const enable  = () => { setForceStepKey(false); onChange(provKey, cfg.llm_provider || "ollama"); };
  const disable = () => { setForceStepKey(false); onChange(provKey, ""); onChange(apiKey, ""); onChange(modelKey, ""); };

  return (
    <div style={{ padding: 14, borderRadius: 14, background: isCustom ? "var(--card)" : "var(--paper-2)", border: `1.5px solid ${isCustom ? `var(--${step.tone})` : "var(--line)"}`, transition: "all .15s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: isCustom ? 14 : 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: isCustom ? `var(--${step.tone}-soft)` : "var(--paper-3)", color: isCustom ? `var(--${step.tone}-ink)` : "var(--ink-3)", display: "grid", placeItems: "center" }}>
              <Icon name={step.icon} size={13} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{step.label}</span>
            {isCustom && (
              <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", background: `var(--${step.tone}-soft)`, color: `var(--${step.tone}-ink)`, padding: "2px 8px", borderRadius: 999 }}>
                {stepProv}{cfg[modelKey] ? ` / ${cfg[modelKey]}` : ""}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", paddingLeft: 33, lineHeight: 1.4 }}>{step.desc}</div>
        </div>
        <button onClick={isCustom ? disable : enable} style={{ padding: "4px 12px", borderRadius: 999, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0, background: isCustom ? "var(--ink)" : "var(--paper-3)", color: isCustom ? "var(--paper)" : "var(--ink-3)", border: `1.5px solid ${isCustom ? "var(--ink)" : "var(--line)"}`, transition: "all .15s ease" }}>
          {isCustom ? "custom" : "global"}
        </button>
      </div>
      {isCustom && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Fournisseur</div>
            <ProviderPills value={stepProv} onChange={v => { setForceStepKey(false); onChange(provKey, v); onChange(apiKey, ""); }} small />
          </div>
          {stepProv !== "ollama" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-2)", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={usesGlobalKey}
                  onChange={e => {
                    if (e.target.checked) {
                      setForceStepKey(false);
                      onChange(apiKey, "");
                    } else {
                      setForceStepKey(true);
                    }
                  }}
                  style={{ width: 14, height: 14, accentColor: "var(--accent)", cursor: "pointer" }}
                />
                <span>{keySourceLabel}</span>
              </label>
              <ApiKeyInput
                value={usesGlobalKey ? "" : (cfg[apiKey] as string)}
                onChange={v => { setForceStepKey(true); onChange(apiKey, v); }}
                provider={stepProv}
                isStep
                disabled={usesGlobalKey}
                api={api}
                secretKey={apiKey}
                placeholder={usesGlobalKey ? "Clé globale utilisée ; choisissez le modèle ci-dessous" : `Clé ${stepProv} optionnelle pour cette étape`}
              />
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Modèle</div>
            <ModelChips provider={stepProv} value={cfg[modelKey] as string} onChange={v => onChange(modelKey, v)} api={api} cfg={cfg} />
          </div>
        </div>
      )}
    </div>
  );
}

export function BigToggle({ active, onToggle, icon, label, badge, sub, tone }: { active: boolean; onToggle: () => void; icon: string; label: string; badge: string; sub: string; tone: string }) {
  return (
    <div onClick={onToggle} style={{ padding: 14, borderRadius: 14, cursor: "pointer", background: active ? `var(--${tone}-soft)` : "var(--paper-2)", border: `1px solid ${active ? `var(--${tone})` : "var(--line)"}`, transition: "all .2s ease", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: active ? `var(--${tone})` : "var(--paper-3)", color: active ? `var(--${tone}-ink)` : "var(--ink-3)", display: "grid", placeItems: "center", transition: "all .2s ease" }}>
          <Icon name={icon} size={15} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
            <span className="mono" style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", background: active ? `var(--${tone})` : "var(--paper-3)", color: active ? `var(--${tone}-ink)` : "var(--ink-3)", padding: "2px 7px", borderRadius: 999, transition: "all .2s ease" }}>{badge}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>
        </div>
      </div>
      <div style={{ width: 42, height: 24, borderRadius: 999, flexShrink: 0, background: active ? `var(--${tone})` : "var(--paper-4)", position: "relative", transition: "background .2s ease" }}>
        <div style={{ position: "absolute", top: 3, left: active ? 21 : 3, width: 18, height: 18, borderRadius: 999, background: "white", transition: "left .2s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
      </div>
    </div>
  );
}
