import { useEffect, useRef, useState } from "react";
import { settingsApi } from "../../../api/settings";
import { GLOBAL_MODEL_FIELD, isSubscriptionProvider, KEY_FIELD, type Cfg, type SubStatus } from "./config";
import { ApiKeyInput, ModelChips, ProviderPills, SectionLabel, SubscriptionNote } from "./shared";
import type { ApiFetch } from "../../../types";
import { readJsonResponse, responseErrorMessage } from "../../../shared/lib/httpError";

type KeyStatus = "ok" | "invalid_key" | "unreachable" | "not_configured" | "unchecked";
type ProviderValidation = { status: KeyStatus; latency_ms?: number };
type ValidationResult = Record<string, ProviderValidation | string[]>;

function readableGlobalSettingsError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("backend local")) {
    return "Backend local injoignable. Vérifiez que l'app est bien démarrée, puis réessayez.";
  }
  if (lower.includes("unknown subscription provider") || lower.includes("fournisseur d'abonnement inconnu")) {
    return "Fournisseur d'abonnement inconnu. Rechargez les réglages puis réessayez.";
  }
  if (lower.includes("cli provider is not installed") || lower.includes("cli de ce fournisseur")) {
    return "Le CLI de ce fournisseur n'est pas installé. Suivez l'aide d'installation puis réessayez.";
  }
  if (lower.includes("oauth") || lower.includes("subscription") || lower.includes("abonnement")) {
    return "La connexion à l'abonnement n'a pas pu démarrer. Vérifiez le fournisseur, puis réessayez.";
  }
  if (lower.includes("api key") || lower.includes("invalid_key") || lower.includes("unauthorized")) {
    return "Une clé fournisseur semble invalide. Vérifiez la clé enregistrée, puis relancez la vérification.";
  }
  if (lower.includes("unreachable") || lower.includes("timeout")) {
    return "Le fournisseur ne répond pas pour l'instant. Réessayez dans quelques secondes.";
  }
  if (lower.includes("vérification") || lower.includes("validation")) {
    return fallback;
  }
  return trimmed;
}

export function GlobalSettings({ cfg, set, onChange, prov, api }: { cfg: Cfg; set: (k: keyof Cfg) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void; onChange: (k: keyof Cfg, v: string) => void; prov: string; api: ApiFetch }) {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<ValidationResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState<Record<string, SubStatus>>({});
  const [signingIn, setSigningIn] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const signIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setSubscriptionError(null);
    try {
      await settingsApi.subscriptionLogin(api, prov);
      // L'OAuth navigateur se fait à côté ; on attend que le statut passe connecté.
      const start = Date.now();
      let connected = false;
      while (mountedRef.current && Date.now() - start < 120000) {
        await new Promise(res => window.setTimeout(res, 2500));
        if (!mountedRef.current) return;
        try {
          const statusResponse = await settingsApi.subscriptionStatus(api);
          if (!statusResponse.ok) throw new Error(await responseErrorMessage(statusResponse, `Le statut d'abonnement a renvoyé ${statusResponse.status}`));
          const d = await readJsonResponse<Record<string, SubStatus>>(
            statusResponse,
            "Le statut d'abonnement a répondu dans un format illisible.",
          );
          if (!mountedRef.current) return;
          setSubStatus(d || {});
          if (d?.[prov]?.logged_in) {
            connected = true;
            setSubscriptionError(null);
            break;
          }
        } catch (statusError) {
          if (mountedRef.current) {
            setSubscriptionError(readableGlobalSettingsError(statusError, "Statut d'abonnement indisponible. Terminez l'authentification dans le navigateur, puis réessayez."));
          }
        }
      }
      if (!connected && mountedRef.current) setSubscriptionError("Connexion non confirmée. Terminez l'authentification dans le navigateur, puis relancez la vérification.");
    } catch (error) {
      if (mountedRef.current) setSubscriptionError(readableGlobalSettingsError(error, "La connexion à l'abonnement n'a pas pu démarrer."));
    } finally {
      if (mountedRef.current) setSigningIn(false);
    }
  };

  useEffect(() => {
    if (!isSubscriptionProvider(prov)) return;
    let alive = true;
    settingsApi.subscriptionStatus(api)
      .then(async r => {
        if (!r.ok) throw new Error(await responseErrorMessage(r, `Le statut d'abonnement a renvoyé ${r.status}`));
        return readJsonResponse<Record<string, SubStatus>>(
          r,
          "Le statut d'abonnement a répondu dans un format illisible.",
        );
      })
      .then(d => {
        if (!alive) return;
        setSubStatus(d || {});
        setSubscriptionError(null);
      })
      .catch(error => {
        if (!alive) return;
        setSubscriptionError(readableGlobalSettingsError(error, "Le statut d'abonnement n'a pas pu être chargé."));
      });
    return () => { alive = false; };
  }, [prov, api]);

  useEffect(() => {
    if (!results && !err) return;
    const timer = window.setTimeout(() => {
      setResults(null);
      setErr(null);
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [results, err]);

  const checkKeys = async () => {
    setChecking(true);
    setErr(null);
    try {
      const r = await settingsApi.validate(api, cfg);
      if (!r.ok) throw new Error(await responseErrorMessage(r, "La vérification des clés a échoué"));
      setResults(await readJsonResponse<ValidationResult>(
        r,
        "La vérification des clés a répondu dans un format illisible.",
      ));
    } catch (e) {
      setErr(readableGlobalSettingsError(e, "La vérification des clés a échoué"));
    } finally {
      setChecking(false);
    }
  };
  const globalModelField = GLOBAL_MODEL_FIELD[prov];

  const badgeStyle = (status: KeyStatus) => {
    const tone = status === "ok" ? "green" : status === "invalid_key" ? "bad" : status === "unreachable" ? "yellow" : "paper";
    if (tone === "bad") return { background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid var(--bad)" };
    if (tone === "paper") return { background: "var(--paper-3)", color: "var(--ink-3)", border: "1px solid var(--line)" };
    return { background: `var(--${tone}-soft)`, color: `var(--${tone}-ink)`, border: `1px solid var(--${tone})` };
  };

  const label = (status: KeyStatus) => ({
    ok: "ok",
    invalid_key: "clé invalide",
    unreachable: "injoignable",
    not_configured: "non configuré",
    unchecked: "non vérifié",
  }[status]);

  const validationWarnings = Array.isArray(results?._warnings) ? results._warnings : [];
  const resultEntries = results
    ? (Object.entries(results).filter(([, result]) => !Array.isArray(result)) as [string, ProviderValidation][]).sort(([left], [right]) => {
      if (left === prov) return -1;
      if (right === prov) return 1;
      return left.localeCompare(right);
    })
    : [];

  return (
    <>
{/* 1. Réglage global */}
          <div>
            <SectionLabel label="Réglage global" sub="utilisé quand une étape n'a pas son propre modèle" />
            <div style={{ padding: 16, borderRadius: 14, background: "var(--paper-2)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}>
              <ProviderPills value={prov} onChange={v => onChange("llm_provider", v)} />
              {prov !== "ollama" && !isSubscriptionProvider(prov) && (
                <ApiKeyInput value={cfg[KEY_FIELD[prov]] as string} onChange={v => onChange(KEY_FIELD[prov], v)} provider={prov} api={api} secretKey={KEY_FIELD[prov]} />
              )}
              {isSubscriptionProvider(prov) && (
                <>
                  <SubscriptionNote provider={prov} status={subStatus[prov]} onSignIn={signIn} busy={signingIn} />
                  {subscriptionError && <div role="alert" style={{ color: "var(--bad)", fontSize: 12, lineHeight: 1.45 }}>{subscriptionError}</div>}
                </>
              )}
              {prov === "ollama" && (
                <input type="text" placeholder="http://localhost:11434/v1" value={cfg.ollama_url} onChange={set("ollama_url")} className="mono field-input"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
              )}
              {prov === "custom" && (
                <input type="text" placeholder="https://llm-gateway.your-domain.test/v1" value={cfg.custom_base_url} onChange={set("custom_base_url")} className="mono field-input"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
              )}
              {prov === "azure" && (
                <input type="text" placeholder="https://your-resource.openai.azure.com" value={cfg.azure_openai_endpoint} onChange={set("azure_openai_endpoint")} className="mono field-input"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
              )}
              {globalModelField && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Modèle global</div>
                  <ModelChips provider={prov} value={cfg[globalModelField] as string} onChange={v => onChange(globalModelField, v)} api={api} cfg={cfg} />
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <button className="btn" onClick={checkKeys} disabled={checking} style={{ alignSelf: "flex-start", fontSize: 12 }}>
                  {checking ? "Vérification..." : "Vérifier les clés"}
                </button>
                {checking && (
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>Vérification des fournisseurs configurés...</div>
                )}
                {err && <div style={{ fontSize: 12, color: "var(--bad)" }}>{err}</div>}
                {results && (
                  <>
                    {validationWarnings.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {validationWarnings.map((warning, index) => (
                          <div key={index} style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--yellow)", background: "var(--yellow-soft)", color: "var(--yellow-ink)", fontSize: 11.5, lineHeight: 1.45 }}>
                            {warning}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                      {resultEntries.map(([provider, result]) => (
                        <div key={provider} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)" }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{provider}</span>
                          <span className="mono" style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, ...badgeStyle(result.status) }}>
                            {label(result.status)}{["ok", "unreachable"].includes(result.status) && result.latency_ms ? ` · ${result.latency_ms}ms` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
    </>
  );
}
