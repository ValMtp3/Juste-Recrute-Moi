import { useState } from "react";
import { motion } from "framer-motion";
import Icon from "./Icon";
import type { ApiFetch } from "../../types";

export function OnboardingWizard({ api, onFinish, onOpenSettings }: { api: ApiFetch; onFinish: (draft: string) => void; onOpenSettings: () => void }) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [rawResume, setRawResume] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [remotePref, setRemotePref] = useState("any");
  const [market, setMarket] = useState("france");
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [jobDraft, setJobDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const steps = ["CV", "Réglage IA", "Tour de l'espace", "Première offre"];
  const keyField: Record<string, string> = {
    openai: "openai_api_key",
    anthropic: "anthropic_key",
    gemini: "gemini_api_key",
    groq: "groq_api_key",
    deepseek: "deepseek_api_key",
    nvidia: "nvidia_api_key",
    xai: "xai_api_key",
    kimi: "kimi_api_key",
    mistral: "mistral_api_key",
    openrouter: "openrouter_api_key",
    together: "together_api_key",
    fireworks: "fireworks_api_key",
    cerebras: "cerebras_api_key",
    perplexity: "perplexity_api_key",
    huggingface: "huggingface_api_key",
  };
  const modelField: Record<string, string> = {
    openai: "openai_model",
    anthropic: "anthropic_model",
    gemini: "gemini_model",
    groq: "groq_model",
    deepseek: "deepseek_model",
    nvidia: "nvidia_model",
    xai: "xai_model",
    kimi: "kimi_model",
    mistral: "mistral_model",
    openrouter: "openrouter_model",
    together: "together_model",
    fireworks: "fireworks_model",
    cerebras: "cerebras_model",
    perplexity: "perplexity_model",
    huggingface: "huggingface_model",
  };
  const modelHints: Record<string, string[]> = {
    openai: ["gpt-4o-mini", "gpt-4o"],
    anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    nvidia: ["z-ai/glm-5.1", "meta/llama-3.1-70b-instruct"],
    xai: ["grok-4", "grok-3", "grok-3-mini"],
    kimi: ["kimi-k2-turbo-preview", "kimi-k2.5", "moonshot-v1-128k"],
    mistral: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
    openrouter: ["openrouter/auto", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-pro"],
    together: ["openai/gpt-oss-120b", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "moonshotai/Kimi-K2-Instruct"],
    fireworks: ["accounts/fireworks/models/llama-v3p1-70b-instruct", "accounts/fireworks/models/qwen2p5-72b-instruct"],
    cerebras: ["llama-3.3-70b", "llama3.1-8b", "gpt-oss-120b"],
    perplexity: ["sonar", "sonar-pro", "sonar-reasoning"],
    huggingface: ["openai/gpt-oss-120b", "meta-llama/Llama-3.1-8B-Instruct"],
  };
  const providerNotes: Record<string, string> = {
    ollama: "Tourne en local via votre serveur Ollama. Idéal pour la confidentialité ; installez les modèles séparément.",
    gemini: "Bon choix rapide et abordable pour adapter les candidatures. Utilise l'endpoint Gemini compatible OpenAI.",
    groq: "Très rapide pour collecter, parser et produire des brouillons. Utilise l'endpoint Groq compatible OpenAI.",
    openai: "Bon choix général pour génération et scoring si vous utilisez déjà OpenAI.",
    anthropic: "Bon choix rédactionnel pour des CV et lettres plus soignés.",
    deepseek: "Utile pour de l'évaluation raisonnée à coût plus bas.",
    nvidia: "Route NIM avancée pour les utilisateurs avec accès API NVIDIA.",
    xai: "Modèles Grok via l'endpoint xAI compatible OpenAI.",
    kimi: "Modèles Moonshot/Kimi via l'API Kimi compatible OpenAI.",
    mistral: "Modèles hébergés Mistral, option européenne intéressante.",
    openrouter: "Une clé pour plusieurs fournisseurs et modèles, pratique pour garder le choix.",
    together: "Hébergement de modèles open source : Llama, DeepSeek, Kimi, Qwen, etc.",
    fireworks: "Hébergement rapide de modèles open source avec accès compatible OpenAI.",
    cerebras: "Inférence très rapide pour les modèles supportés.",
    perplexity: "Modèles ancrés recherche, utiles pour les réponses avec contexte externe.",
    huggingface: "Routeur Hugging Face vers les fournisseurs d'inférence supportés.",
  };
  const tourPages = [
    { name: "Adapter", detail: "Collez une URL ou une description d'offre, analysez l'adéquation et générez CV, lettre et messages depuis un seul écran." },
    { name: "Tableau de bord", detail: "Suivez les offres enregistrées, le pipeline, l'activité récente, la couverture des sources et le travail de l'agent." },
    { name: "Pipeline d'offres", detail: "Scannez les sources, relisez les offres trouvées, triez par score et signal, ouvrez les détails et retirez les pistes faibles." },
    { name: "Graphe", detail: "Inspectez le graphe local construit depuis votre CV, vos projets, GitHub, portfolio et contexte manuel." },
    { name: "Activité", detail: "Consultez les événements de scan, scoring, génération, scraping, import et erreurs pour auditer les décisions." },
    { name: "Profil", detail: "Modifiez identité, expériences, compétences, formations, liens et valeurs par défaut utilisées dans les dossiers générés." },
    { name: "Ajouter du contexte", detail: "Importez projets, pages portfolio, données GitHub, notes, réussites ou compléments de CV dans la base locale." },
    { name: "Guide de démarrage", detail: "Rouvrez cet assistant depuis la barre latérale pour revérifier clés, sources, pages ou premier dossier." },
  ];

  const saveResume = async () => {
    if (!file && !rawResume.trim()) {
      setErr("Importez un fichier CV ou collez le texte du CV.");
      return;
    }
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    if (file) fd.append("file", file);
    else fd.append("raw", rawResume.trim());
    try {
      const r = await api(`/api/v1/ingest`, { method: "POST", body: fd });
      if (!r.ok) {
        const detail = await r.json().then(d => d.detail).catch(() => "");
        throw new Error(detail || `L'import du CV a renvoyé ${r.status}`);
      }
      window.dispatchEvent(new CustomEvent("profile-refresh"));
      window.dispatchEvent(new CustomEvent("graph-refresh"));
      setStep(1);
    } catch (e) {
      const message = e instanceof Error ? e.message : "L'import du CV a échoué";
      setErr(message === "Failed to fetch" ? "Backend local injoignable. Relance Juste Recrute Moi puis réessaie." : message);
    } finally {
      setBusy(false);
    }
  };

  const savePreferences = async () => {
    setBusy(true);
    setErr(null);
    const trimmedRole = role.trim();
    const payload: Record<string, any> = {
      job_market_focus: market,
      remote_preference: remotePref,
      llm_provider: provider,
      free_sources_enabled: true,
    };
    if (trimmedRole) {
      payload.onboarding_target_role = trimmedRole;
      payload.desired_position = trimmedRole;
    }
    // Une localisation explicite remplace celle détectée dans le CV.
    // Si le champ reste vide, la recherche reprend la localisation du profil.
    if (location.trim()) payload.job_location = location.trim();
    if (provider === "ollama") payload.ollama_url = ollamaUrl;
    const field = keyField[provider];
    if (field && apiKey.trim()) payload[field] = apiKey.trim();
    const modelKey = modelField[provider];
    if (modelKey && model.trim()) payload[modelKey] = model.trim();
    try {
      const r = await api(`/api/v1/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`Les préférences ont renvoyé ${r.status}`);
      setStep(2);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Les préférences n'ont pas pu être enregistrées");
    } finally {
      setBusy(false);
    }
  };

  const progress = (
    <div className="row gap-2" style={{ flexWrap: "wrap" }}>
      {steps.map((label, idx) => (
        <button
          key={label}
          className="btn btn-ghost"
          onClick={() => idx <= step && setStep(idx)}
          style={{
            borderColor: idx === step ? "var(--accent)" : idx < step ? "var(--green)" : "var(--line)",
            background: idx === step ? "var(--accent-soft)" : idx < step ? "var(--green-soft)" : "var(--paper-3)",
            color: idx === step ? "var(--ink)" : idx < step ? "var(--green-ink)" : "var(--ink-3)",
            fontSize: 12,
            minHeight: 34,
          }}
        >
          {idx < step ? <Icon name="check" size={13} /> : <span className="mono">{idx + 1}</span>} {label}
        </button>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(var(--cream-rgb),0.94)", display: "grid", placeItems: "center", padding: 22 }}
    >
      <motion.section
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 10, opacity: 0 }}
        className="card"
        style={{ width: "min(960px, 100%)", maxHeight: "min(760px, 94vh)", overflow: "auto", padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div className="eyebrow">Premier lancement</div>
            <h2 style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>Préparer votre premier dossier</h2>
            <p style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.55, marginTop: 8 }}>
              Importez votre CV, connectez l'IA, découvrez l'espace de travail, puis adaptez une vraie offre.
            </p>
          </div>
          {progress}
          <div style={{ background: "var(--paper-3)", border: "1px solid var(--line)", borderRadius: 8, padding: 14, color: "var(--ink-2)", fontSize: 13, lineHeight: 1.55 }}>
            <b style={{ color: "var(--ink)" }}>{steps[step]}</b>
            <div style={{ marginTop: 4 }}>
              {step === 0 && "Le graphe profil démarre avec les données du CV."}
              {step === 1 && "Ces réglages influencent le scoring, la génération, les sources et les dossiers créés."}
              {step === 2 && "Chaque page participe au même flux local-first : trouver, comprendre, adapter, candidater et apprendre des résultats."}
              {step === 3 && "Collez une vraie offre maintenant ou ouvrez Adapter vide pour l'ajouter plus tard."}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => onFinish("")} style={{ alignSelf: "flex-start" }}>
            Ignorer la configuration
          </button>
        </div>

        <div style={{ minWidth: 0 }}>
          {err && <div style={{ color: "var(--bad)", background: "var(--bad-soft)", border: "1px solid var(--bad)", borderRadius: 8, padding: "9px 11px", fontSize: 12, marginBottom: 12 }}>{err}</div>}

          {step === 0 && (
            <div className="col gap-4">
              <label className="card" style={{ padding: 18, cursor: "pointer", borderStyle: "dashed", background: "var(--paper)" }}>
                <input type="file" accept=".pdf,.docx,.txt,.md" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] || null)} />
                <div className="row gap-3">
                  <Icon name="upload" size={20} />
                  <div>
                    <div style={{ fontWeight: 800 }}>{file ? file.name : "Importer un CV"}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>PDF, DOCX, TXT ou Markdown</div>
                  </div>
                </div>
              </label>
              <textarea
                className="field-input"
                value={rawResume}
                onChange={e => setRawResume(e.target.value)}
                placeholder="Ou collez le texte du CV"
                rows={8}
                style={{ lineHeight: 1.55, resize: "vertical" }}
              />
              <button className="btn btn-accent" onClick={saveResume} disabled={busy} style={{ justifyContent: "center", padding: "12px 16px" }}>
                <Icon name="arrow-right" size={14} color="#fff" /> {busy ? "Import..." : "Continuer"}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="col gap-4">
              <div>
                <label className="eyebrow">Poste recherché</label>
                <input className="field-input" value={role} onChange={e => setRole(e.target.value)} placeholder="ex. développeur backend, chef de projet, commercial, infirmier" style={{ marginTop: 7 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="eyebrow">Localisation <span style={{ opacity: 0.6, textTransform: "none", fontWeight: 400 }}>(facultatif ; sinon déduite du CV)</span></label>
                  <input className="field-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="ex. Montpellier, Paris, Lyon, France" style={{ marginTop: 7 }} />
                </div>
                <div>
                  <label className="eyebrow">Mode de travail</label>
                  <select className="field-input" value={remotePref} onChange={e => setRemotePref(e.target.value)} style={{ marginTop: 7 }}>
                    <option value="any">Indifférent</option>
                    <option value="remote">Télétravail</option>
                    <option value="hybrid">Hybride</option>
                    <option value="onsite">Sur site</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="eyebrow">Marché</label>
                  <select className="field-input" value={market} onChange={e => setMarket(e.target.value)} style={{ marginTop: 7 }}>
                    <option value="france">France</option>
                    <option value="global">International</option>
                    <option value="india">Inde</option>
                  </select>
                </div>
                <div>
                  <label className="eyebrow">Fournisseur IA</label>
                  <select className="field-input" value={provider} onChange={e => { const next = e.target.value; setProvider(next); setApiKey(""); setModel(modelHints[next]?.[0] || ""); }} style={{ marginTop: 7 }}>
                    <option value="ollama">Ollama</option>
                    <option value="gemini">Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="xai">Grok / xAI</option>
                    <option value="kimi">Kimi / Moonshot</option>
                    <option value="mistral">Mistral</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="together">Together</option>
                    <option value="fireworks">Fireworks</option>
                    <option value="cerebras">Cerebras</option>
                    <option value="perplexity">Perplexity</option>
                    <option value="huggingface">Hugging Face</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="nvidia">NVIDIA</option>
                  </select>
                </div>
              </div>
              <div style={{ background: "var(--paper-3)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)" }}>
                <b style={{ color: "var(--ink)" }}>{provider === "ollama" ? "Mode local" : provider.toUpperCase()}</b>
                <div style={{ marginTop: 4 }}>{providerNotes[provider]}</div>
              </div>
              {provider === "ollama" ? (
                <div>
                  <label className="eyebrow">Ollama URL</label>
                  <input className="field-input" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} style={{ marginTop: 7 }} />
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label className="eyebrow">Clé API</label>
                    <input className="field-input" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Facultatif pour l'instant" style={{ marginTop: 7 }} />
                  </div>
                  <div>
                    <label className="eyebrow">Modèle par défaut</label>
                    <select className="field-input" value={model} onChange={e => setModel(e.target.value)} style={{ marginTop: 7 }}>
                      {(modelHints[provider] || []).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="row gap-2" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <button className="btn" onClick={onOpenSettings}><Icon name="settings" size={13} /> Réglages avancés</button>
                <button className="btn btn-accent" onClick={savePreferences} disabled={busy} style={{ minWidth: 170, justifyContent: "center" }}>
                  <Icon name="arrow-right" size={14} color="#fff" /> {busy ? "Enregistrement..." : "Continuer"}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="col gap-4">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
                {tourPages.map(page => (
                  <div key={page.name} style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--paper)", padding: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{page.name}</div>
                    <div style={{ color: "var(--ink-2)", fontSize: 12, lineHeight: 1.45, marginTop: 5 }}>{page.detail}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn-accent" onClick={() => setStep(3)} style={{ justifyContent: "center", padding: "12px 16px" }}>
                  <Icon name="arrow-right" size={14} color="#fff" /> Continuer
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="col gap-4">
              <div>
                <label className="eyebrow">URL ou description de l'offre</label>
                <textarea className="field-input" value={jobDraft} onChange={e => setJobDraft(e.target.value)} rows={12} style={{ marginTop: 7, lineHeight: 1.55, resize: "vertical" }} />
              </div>
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                <button className="btn btn-accent" onClick={() => onFinish(jobDraft)} disabled={!jobDraft.trim()} style={{ justifyContent: "center", padding: "12px 16px", flex: "1 1 220px" }}>
                  <Icon name="spark" size={14} color="#fff" /> Tester sur cette offre
                </button>
                <button className="btn" onClick={() => onFinish("")} style={{ justifyContent: "center", flex: "1 1 220px" }}>
                  Ouvrir Adapter
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
