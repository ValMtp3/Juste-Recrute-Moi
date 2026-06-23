import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Icon from "../../shared/components/Icon";
import type { ApiFetch } from "../../types";

async function responseErrorMessage(response: Response, fallback: string) {
      // M3 : afficher le délai Retry-After au lieu d'une erreur 429 générique.
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return `Trop de requêtes. Patientez ${retryAfter} seconde${retryAfter === 1 ? "" : "s"}, puis réessayez.`;
    }
  }
  try {
    const data = await response.clone().json();
    const detail = data?.detail ?? data?.error;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (detail) return JSON.stringify(detail);
  } catch {
    // Fall through to text/plain error bodies.
  }
  try {
    const text = await response.text();
    if (text.trim()) return text;
  } catch {
    // Fall through to the caller-provided fallback.
  }
  return fallback;
}

function requestErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function IngestionView({ api }: { api: ApiFetch }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"resume" | "manual" | "raw" | "template" | "linkedin" | "github" | "portfolio" | "json-import">("resume");

  // Forms
  const [skillForm, setSkillForm] = useState({ n: "", cat: "technical" });
  const [expForm, setExpForm]     = useState({ role: "", co: "", period: "", d: "" });
  const [projForm, setProjForm]   = useState({ title: "", stack: "", repo: "", impact: "" });
  const [identityForm, setIdentityForm] = useState({ email: "", phone: "", linkedin_url: "", github_url: "", website_url: "", city: "" });
  const [eduForm, setEduForm] = useState({ title: "" });
  const [certForm, setCertForm] = useState({ title: "" });
  const [achievementForm, setAchievementForm] = useState({ title: "" });
  const [rawText, setRawText]     = useState("");
  const [template, setTemplate]   = useState("");
  const [templateLoaded, setTemplateLoaded] = useState(false);

  // LinkedIn tab state
  const [linkedinFile, setLinkedinFile] = useState<File | null>(null);
  const [linkedinResult, setLinkedinResult] = useState<any>(null);
  // GitHub tab state
  const [githubUsername, setGithubUsername] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubResult, setGithubResult] = useState<any>(null);
  const [showToken, setShowToken] = useState(false);
  const [githubMaxRepos, setGithubMaxRepos] = useState(100);
  // Portfolio tab state
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [portfolioResult, setPortfolioResult] = useState<any>(null);
  // JSON import tab state
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonResult, setJsonResult] = useState<any>(null);

  // Load existing template on mount
  useEffect(() => {
    if (activeTab !== "template" || templateLoaded) return;
    api(`/api/v1/template`)
      .then(r => r.json())
      .then(d => { setTemplate(d.template || ""); setTemplateLoaded(true); })
      .catch(() => {});
  }, [activeTab, api, templateLoaded]);

  const saveTemplate = async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const r = await api(`/api/v1/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (r.ok) {
        setStatus("done");
      } else {
        setErrorMessage(await responseErrorMessage(r, "Le modèle de CV n'a pas pu être enregistré."));
        setStatus("error");
      }
    } catch (err) {
      setErrorMessage(requestErrorMessage(err, "Le modèle de CV n'a pas pu être enregistré."));
      setStatus("error");
    }
  };

  const addManual = async (type: string, data: any) => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const endpointType = type === "exp" ? "experience" : type;
      const r = await api(`/api/v1/profile/${endpointType}`, {
        method: type === "identity" ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (r.ok) {
        setStatus("done");
        if (type === "skill")   setSkillForm({ n: "", cat: "technical" });
        if (type === "exp")     setExpForm({ role: "", co: "", period: "", d: "" });
        if (type === "project") setProjForm({ title: "", stack: "", repo: "", impact: "" });
        if (type === "identity") setIdentityForm({ email: "", phone: "", linkedin_url: "", github_url: "", website_url: "", city: "" });
        if (type === "education") setEduForm({ title: "" });
        if (type === "certification") setCertForm({ title: "" });
        if (type === "achievement") setAchievementForm({ title: "" });
        window.dispatchEvent(new CustomEvent("profile-refresh"));
        window.dispatchEvent(new CustomEvent("graph-refresh"));
      } else {
        setErrorMessage(await responseErrorMessage(r, "Le contexte du profil n'a pas pu être enregistré."));
        setStatus("error");
      }
    } catch (err) {
      setErrorMessage(requestErrorMessage(err, "Le contexte du profil n'a pas pu être enregistré."));
      setStatus("error");
    }
  };

  const ingestResume = async (file: File) => {
    setStatus("loading");
    setErrorMessage(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api(`/api/v1/ingest`, { method: "POST", body: fd, timeoutMs: 0 });
      if (r.ok) {
        await r.json().catch(() => ({}));
        window.dispatchEvent(new CustomEvent("profile-refresh"));
        window.dispatchEvent(new CustomEvent("graph-refresh"));
        setStatus("done");
      } else {
        setErrorMessage(await responseErrorMessage(r, "Ce CV n'a pas pu être importé."));
        setStatus("error");
      }
    } catch (err) {
      setErrorMessage(requestErrorMessage(err, "Ce CV n'a pas pu être importé."));
      setStatus("error");
    }
  };

  const ingestLinkedin = async () => {
    if (!linkedinFile) return;
    setStatus("loading");
    setLinkedinResult(null);
    const fd = new FormData();
    fd.append("file", linkedinFile);
    try {
      const isPdf = linkedinFile.name.toLowerCase().endsWith(".pdf");
      const r = await api(isPdf ? `/api/v1/ingest` : `/api/v1/ingest/linkedin`, { method: "POST", body: fd, timeoutMs: 0 });
      if (r.ok) {
        const data = await r.json();
        setLinkedinResult(isPdf ? {
          status: "ok",
          source: "pdf",
          stats: {
            skills: data?.skills?.length ?? 0,
            experience: data?.exp?.length ?? data?.experience?.length ?? 0,
            projects: data?.projects?.length ?? 0,
            certifications: data?.certifications?.length ?? 0,
          },
        } : data);
        window.dispatchEvent(new CustomEvent("profile-refresh"));
        window.dispatchEvent(new CustomEvent("graph-refresh"));
        setStatus("idle");
      } else {
        const data = await r.json().catch(() => ({}));
        setLinkedinResult({ errorMsg: data?.detail || `Import échoué (${r.status})` });
        setStatus("idle");
      }
    } catch (err: any) {
      setLinkedinResult({ errorMsg: err?.message || "Le contexte LinkedIn n'a pas pu être importé." });
      setStatus("idle");
    }
  };

  const ingestGithub = async () => {
    setStatus("loading");
    setGithubResult(null);
    try {
      const r = await api(`/api/v1/ingest/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: githubUsername, token: githubToken, max_repos: githubMaxRepos }),
        timeoutMs: 0,
      });
      if (r.ok) {
        const data = await r.json();
        setGithubResult(data);
        window.dispatchEvent(new CustomEvent("profile-refresh"));
        window.dispatchEvent(new CustomEvent("graph-refresh"));
        setStatus("idle");
      } else {
        const data = await r.json().catch(() => ({}));
        setGithubResult({ errorMsg: data?.detail || `Import GitHub échoué (${r.status})` });
        setStatus("idle");
      }
    } catch (err: any) {
      setGithubResult({ errorMsg: err?.message || "Le backend local est injoignable." });
      setStatus("idle");
    }
  };

  const scanPortfolio = async (autoImport = false) => {
    setStatus("loading");
    if (!autoImport) setPortfolioResult(null);
    try {
      const r = await api(`/api/v1/ingest/portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: portfolioUrl, auto_import: autoImport }),
        timeoutMs: 0,
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setPortfolioResult(data);
        setStatus("idle");
      } else {
        setPortfolioResult({ errorMsg: data?.detail || "Impossible de récupérer le portfolio." });
        setStatus("idle");
      }
    } catch (err: any) {
      setPortfolioResult({ errorMsg: err?.message || "Impossible de récupérer le portfolio." });
      setStatus("idle");
    }
  };

  const importPortfolioResult = async () => {
    if (!portfolioResult || portfolioResult.errorMsg || portfolioResult.error) return;
    setStatus("loading");
    setPortfolioResult({ ...portfolioResult, importError: null });
    const payload = {
      candidate: portfolioResult.candidate,
      identity: portfolioResult.identity,
      skills: portfolioResult.skills || [],
      projects: portfolioResult.projects || [],
      achievements: portfolioResult.achievements || [],
      experience: portfolioResult.experience || [],
      education: portfolioResult.education || [],
      certifications: portfolioResult.certifications || [],
    };
    try {
      const r = await api(`/api/v1/ingest/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeoutMs: 0,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPortfolioResult({ ...portfolioResult, importError: data?.detail || `Import échoué (${r.status})` });
        setStatus("idle");
        return;
      }
      setPortfolioResult({ ...portfolioResult, imported: data });
      window.dispatchEvent(new CustomEvent("profile-refresh"));
      window.dispatchEvent(new CustomEvent("graph-refresh"));
      setStatus("idle");
    } catch (err: any) {
      setPortfolioResult({ ...portfolioResult, importError: err?.message || "Le portfolio n'a pas pu être importé." });
      setStatus("idle");
    }
  };

  const downloadProfileTemplate = async () => {
    try {
      const r = await api(`/api/v1/ingest/profile/template`);
      if (!r.ok) throw new Error(`Téléchargement du modèle échoué (${r.status})`);
      const data = await r.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jhm_profile_template.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setJsonError("Le modèle n'a pas pu être téléchargé.");
    }
  };

  const importProfileJson = async () => {
    setJsonError(null);
    setJsonResult(null);
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err: any) {
      setJsonError(err?.message || "JSON invalide.");
      return;
    }
    setStatus("loading");
    try {
      const r = await api(`/api/v1/ingest/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
        timeoutMs: 0,
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setJsonResult(data);
        window.dispatchEvent(new CustomEvent("profile-refresh"));
        window.dispatchEvent(new CustomEvent("graph-refresh"));
        setStatus("idle");
      } else {
        setJsonError(data?.detail ? JSON.stringify(data.detail) : `Import échoué (${r.status})`);
        setStatus("idle");
      }
    } catch {
      setJsonError("Le profil JSON n'a pas pu être importé.");
      setStatus("idle");
    }
  };

  const ingestRaw = async () => {
    setStatus("loading");
    setErrorMessage(null);
    const fd = new FormData();
    fd.append("raw", rawText);
    try {
      const r = await api(`/api/v1/ingest`, { method: "POST", body: fd, timeoutMs: 0 });
      if (r.ok) {
        window.dispatchEvent(new CustomEvent("profile-refresh"));
        window.dispatchEvent(new CustomEvent("graph-refresh"));
        setStatus("done");
        setRawText("");
      } else {
        setErrorMessage(await responseErrorMessage(r, "Impossible de synchroniser le contexte brut."));
        setStatus("error");
      }
    } catch (err) {
      setErrorMessage(requestErrorMessage(err, "Impossible de synchroniser le contexte brut."));
      setStatus("error");
    }
  };

  const TABS = [
    { id: "resume" as const, label: "CV", description: "PDF, DOCX, texte", icon: "upload", accent: "teal" },
    { id: "manual" as const, label: "Manuel", description: "Compétences, rôles, projets", icon: "plus", accent: "blue" },
    { id: "raw" as const, label: "Texte brut", description: "Coller des notes", icon: "file", accent: "yellow" },
    { id: "template" as const, label: "Modèle", description: "Format de CV", icon: "layers", accent: "purple" },
    { id: "linkedin" as const, label: "LinkedIn", description: "Export de données", icon: "brief", accent: "blue" },
    { id: "github" as const, label: "GitHub", description: "Signaux dépôt", icon: "external-link", accent: "green" },
    { id: "portfolio" as const, label: "Portfolio", description: "Site personnel", icon: "globe", accent: "orange" },
    { id: "json-import" as const, label: "JSON", description: "Import structuré", icon: "download", accent: "pink" },
  ];
  const activeTabMeta = TABS.find(t => t.id === activeTab) ?? TABS[0];
  const githubProgressSteps = [
    "Récupération des dépôts",
    "Lecture des README et langages",
    "Nettoyage des signaux de stack",
    "Enregistrement du profil",
    "Synchronisation graphe et vecteurs",
  ];

  return (
    <div className="ingestion-page scroll">
      <div className="ingestion-shell">
        <div className="ingestion-hero">
          <div className="ingestion-hero-copy">
            <span className="eyebrow">Pipeline append-only</span>
            <h2>Ajouter du contexte</h2>
            <p>Fusionnez CV, dépôts, pages portfolio, exports et notes manuelles dans un graphe d'identité propre.</p>
          </div>
          <div className={`ingestion-active-card ingestion-accent-${activeTabMeta.accent}`}>
            <div className="ingestion-active-icon"><Icon name={activeTabMeta.icon} size={18} /></div>
            <div>
              <span>Source active</span>
              <strong>{activeTabMeta.label}</strong>
            </div>
          </div>
        </div>

        <div className="ingestion-tabs" role="tablist" aria-label="Context source">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setStatus("idle"); setErrorMessage(null); }}
              className={`ingestion-tab ingestion-accent-${t.accent} ${activeTab === t.id ? "active" : ""}`}
              role="tab"
              aria-selected={activeTab === t.id}>
              <span className="ingestion-tab-icon"><Icon name={t.icon} size={15} /></span>
              <span className="ingestion-tab-copy">
                <strong>{t.label}</strong>
                <small>{t.description}</small>
              </span>
            </button>
          ))}
        </div>

        {status === "done" && (
          <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="ingestion-alert success">
            <Icon name="check" size={18} /><div style={{fontWeight:600}}>Enregistré avec succès.</div>
          </motion.div>
        )}
        {status === "error" && (
          <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="ingestion-alert error">
            {errorMessage || "Une erreur est survenue."}
          </motion.div>
        )}

        {activeTab === "resume" && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card col gap-4" style={{ padding: "64px 32px", alignItems: "center", textAlign: "center", border: "2px dashed var(--line)", background: "var(--paper-2)" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--teal-soft)", color: "var(--teal)", display: "grid", placeItems: "center" }}><Icon name="upload" size={28} /></div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>Déposez un CV récent</div>
            <div style={{ fontSize: 14, color: "var(--ink-3)", maxWidth: 360, lineHeight: 1.5 }}>PDF, DOCX, TXT ou Markdown. L'agent détecte compétences, rôles et projets, puis les ajoute au graphe.</div>
            <input type="file" accept=".pdf,.docx,.txt,.md" onChange={e => e.target.files?.[0] && ingestResume(e.target.files[0])} style={{ display: "none" }} id="resume-in" />
            <button className="btn btn-primary" style={{ marginTop: 16, padding: "12px 32px", fontSize: 15 }} onClick={() => document.getElementById("resume-in")?.click()}>Choisir un fichier CV</button>
            {status === "loading" && <div className="mono pulse" style={{ fontSize: 12, marginTop: 16 }}>Analyse du CV, enregistrement du profil, synchronisation du graphe...</div>}
          </motion.div>
        )}

        {activeTab === "manual" && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="col gap-8">
            <div className="card col gap-4" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}><Icon name="spark" size={16}/> Ajouter une compétence</h3>
              <input className="field-input" placeholder="Nom de la compétence" value={skillForm.n} onChange={v => setSkillForm({...skillForm, n: v.target.value})} />
              <select className="field-input" value={skillForm.cat} onChange={v => setSkillForm({...skillForm, cat: v.target.value})}>
                <option value="technical">Technique</option>
                <option value="soft">Compétence humaine</option>
                <option value="tool">Outil / utilitaire</option>
                 <option value="language">Langage</option>
                <option value="framework">Framework</option>
              </select>
               <button className="btn btn-primary" style={{alignSelf:"flex-start",padding:"10px 24px"}} onClick={() => addManual("skill", skillForm)} disabled={status==="loading" || !skillForm.n.trim()}>Ajouter la compétence</button>
            </div>
            <div className="card col gap-4" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}><Icon name="brief" size={16}/> Ajouter une expérience</h3>
              <input className="field-input" placeholder="Intitulé du poste" value={expForm.role} onChange={v => setExpForm({...expForm, role: v.target.value})} />
              <input className="field-input" placeholder="Entreprise" value={expForm.co} onChange={v => setExpForm({...expForm, co: v.target.value})} />
              <input className="field-input" placeholder="Période (ex. 2022-2024)" value={expForm.period} onChange={v => setExpForm({...expForm, period: v.target.value})} />
              <textarea className="field-input" placeholder="Description" rows={3} value={expForm.d} onChange={v => setExpForm({...expForm, d: v.target.value})} />
              <button className="btn btn-primary" style={{alignSelf:"flex-start",padding:"10px 24px"}} onClick={() => addManual("exp", expForm)} disabled={status==="loading" || (!expForm.role.trim() && !expForm.co.trim())}>Ajouter l'expérience</button>
            </div>
            <div className="card col gap-4" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}><Icon name="layers" size={16}/> Ajouter un projet</h3>
              <input className="field-input" placeholder="Titre du projet" value={projForm.title} onChange={v => setProjForm({...projForm, title: v.target.value})} />
              <input className="field-input" placeholder="Stack (séparée par des virgules)" value={projForm.stack} onChange={v => setProjForm({...projForm, stack: v.target.value})} />
              <input className="field-input" placeholder="URL du repo (facultatif)" value={projForm.repo} onChange={v => setProjForm({...projForm, repo: v.target.value})} />
              <textarea className="field-input" placeholder="Impact / description" rows={3} value={projForm.impact} onChange={v => setProjForm({...projForm, impact: v.target.value})} />
              <button className="btn btn-primary" style={{alignSelf:"flex-start",padding:"10px 24px"}} onClick={() => addManual("project", projForm)} disabled={status==="loading" || !projForm.title.trim()}>Ajouter le projet</button>
            </div>
            <div className="card col gap-4" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}><Icon name="user" size={16}/> Contact et liens</h3>
              <div className="grid-2 gap-3">
                <input className="field-input" placeholder="Adresse email" value={identityForm.email} onChange={v => setIdentityForm({...identityForm, email: v.target.value})} />
                <input className="field-input" placeholder="Téléphone" value={identityForm.phone} onChange={v => setIdentityForm({...identityForm, phone: v.target.value})} />
                <input className="field-input" placeholder="LinkedIn URL" value={identityForm.linkedin_url} onChange={v => setIdentityForm({...identityForm, linkedin_url: v.target.value})} />
                <input className="field-input" placeholder="GitHub URL" value={identityForm.github_url} onChange={v => setIdentityForm({...identityForm, github_url: v.target.value})} />
                <input className="field-input" placeholder="Portfolio / site web" value={identityForm.website_url} onChange={v => setIdentityForm({...identityForm, website_url: v.target.value})} />
                <input className="field-input" placeholder="Ville / localisation" value={identityForm.city} onChange={v => setIdentityForm({...identityForm, city: v.target.value})} />
              </div>
              <button className="btn btn-primary" style={{alignSelf:"flex-start",padding:"10px 24px"}} onClick={() => addManual("identity", identityForm)} disabled={status==="loading"}>Enregistrer le contact</button>
            </div>
            <div className="grid-2 gap-4">
              <div className="card col gap-4" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}><Icon name="file" size={16}/> Ajouter une formation</h3>
                <input className="field-input" placeholder="Diplôme, école, année" value={eduForm.title} onChange={v => setEduForm({...eduForm, title: v.target.value})} />
                <button className="btn btn-primary" style={{alignSelf:"flex-start",padding:"10px 24px"}} onClick={() => addManual("education", eduForm)} disabled={status==="loading" || !eduForm.title.trim()}>Ajouter la formation</button>
              </div>
              <div className="card col gap-4" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}><Icon name="check" size={16}/> Ajouter une certification</h3>
                <input className="field-input" placeholder="Certification, organisme, année" value={certForm.title} onChange={v => setCertForm({...certForm, title: v.target.value})} />
                <button className="btn btn-primary" style={{alignSelf:"flex-start",padding:"10px 24px"}} onClick={() => addManual("certification", certForm)} disabled={status==="loading" || !certForm.title.trim()}>Ajouter la certification</button>
              </div>
            </div>
            <div className="card col gap-4" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}><Icon name="trending" size={16}/> Ajouter une réussite</h3>
              <input className="field-input" placeholder="Prix, publication, jalon livré, résultat de concours" value={achievementForm.title} onChange={v => setAchievementForm({...achievementForm, title: v.target.value})} />
              <button className="btn btn-primary" style={{alignSelf:"flex-start",padding:"10px 24px"}} onClick={() => addManual("achievement", achievementForm)} disabled={status==="loading" || !achievementForm.title.trim()}>Ajouter la réussite</button>
            </div>
          </motion.div>
        )}

        {activeTab === "raw" && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card col gap-4" style={{ padding: 24 }}>
            <div className="eyebrow">Agrégateur de texte brut</div>
            <textarea className="field-input" placeholder="Collez du texte non structuré depuis LinkedIn, un site personnel ou des notes..." rows={16} value={rawText} onChange={v => setRawText(v.target.value)} style={{ fontSize: 14, lineHeight: 1.6 }} />
            <button className="btn btn-primary" style={{ padding: 16, fontSize: 15 }} onClick={ingestRaw} disabled={status==="loading"}>
              {status === "loading" ? "Traitement..." : "Synchroniser le contexte brut"}
            </button>
          </motion.div>
        )}

        {activeTab === "linkedin" && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="col gap-4">
            <div
              className="card col gap-4"
              style={{ padding: "48px 32px", alignItems: "center", textAlign: "center", border: "2px dashed var(--line)", background: "var(--paper-2)", cursor: "pointer" }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                const lower = f?.name.toLowerCase() || "";
                if (f && (lower.endsWith(".zip") || lower.endsWith(".pdf"))) { setLinkedinFile(f); setLinkedinResult(null); }
              }}
              onClick={() => document.getElementById("linkedin-zip-in")?.click()}
            >
              <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--teal-soft)", color: "var(--teal)", display: "grid", placeItems: "center" }}><Icon name="upload" size={28} /></div>
              <div style={{ fontWeight: 600, fontSize: 18 }}>
                {linkedinFile ? linkedinFile.name : "Déposez votre export LinkedIn (.zip) ou PDF de profil ici"}
              </div>
              <div style={{ fontSize: 14, color: "var(--ink-3)", maxWidth: 400, lineHeight: 1.5 }}>
                {linkedinFile ? "Fichier prêt à importer." : "ou cliquez pour parcourir"}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", maxWidth: 420, lineHeight: 1.6, marginTop: 4 }}>
                Utilisez un export LinkedIn ZIP pour un import structuré, ou un PDF de profil LinkedIn pour une extraction rapide.
              </div>
              <input type="file" accept=".zip,.pdf,application/zip,application/pdf" id="linkedin-zip-in" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setLinkedinFile(f); setLinkedinResult(null); } }} />
            </div>
            <button className="btn btn-primary" style={{ padding: 16, fontSize: 15 }}
              disabled={!linkedinFile || status === "loading"}
              onClick={ingestLinkedin}>
              {status === "loading" ? "Import..." : linkedinFile?.name.toLowerCase().endsWith(".pdf") ? "Importer le PDF LinkedIn" : "Importer les données LinkedIn"}
            </button>
            {linkedinResult?.errorMsg && (
              <div style={{ padding: 16, background: "var(--bad-soft)", color: "var(--bad)", borderRadius: 12, border: "1px solid var(--bad)", fontSize: 14 }}>
                {linkedinResult.errorMsg}
              </div>
            )}
            {linkedinResult && !linkedinResult.errorMsg && (
              <div style={{
                padding: 16,
                background: linkedinResult.status === "ok" ? "var(--green-soft)" : "var(--paper-3)",
                color: linkedinResult.status === "ok" ? "var(--green-ink)" : "var(--ink-2)",
                borderRadius: 12,
                border: `1px solid ${linkedinResult.status === "ok" ? "var(--green)" : "var(--line)"}`,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Importé : {linkedinResult.stats?.skills ?? 0} compétences - {linkedinResult.stats?.experience ?? 0} expériences - {linkedinResult.stats?.projects ?? 0} projets - {linkedinResult.stats?.certifications ?? 0} certifications
                </div>
                {linkedinResult.source === "pdf" && (
                  <div style={{ fontSize: 13, marginTop: 4, color: "var(--ink-3)" }}>PDF de profil analysé et synchronisé dans le graphe d'identité.</div>
                )}
                {linkedinResult.status === "partial" && (
                  <div style={{ fontSize: 13, marginTop: 4, color: "var(--ink-3)" }}>Certains éléments n'ont pas pu être importés.</div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "github" && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="col gap-4">
            <div className="card col gap-4" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Nom d'utilisateur GitHub</h3>
              <input className="field-input" placeholder="ex. torvalds" value={githubUsername}
                onChange={e => setGithubUsername(e.target.value)} />
              <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: 13, padding: "6px 12px" }}
                onClick={() => setShowToken(t => !t)}>
                {showToken ? "- Masquer le token" : "+ Ajouter un token GitHub pour lever les limites"}
              </button>
              {showToken && (
                <div className="col gap-2">
                  <input className="field-input" type="password" placeholder="ghp_..." value={githubToken}
                    onChange={e => setGithubToken(e.target.value)} />
                  <div style={{ fontSize: 12, color: "var(--ink-4)", lineHeight: 1.5 }}>
                    Facultatif : passe la limite API de 60 à 5 000 requêtes/heure. Jamais stocké à distance.
                  </div>
                </div>
              )}
              <div className="row gap-3" style={{ alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "var(--ink-2)" }}>Repos max à scanner :</span>
                <input className="field-input" type="number" min={1} max={500} value={githubMaxRepos}
                  style={{ width: 80 }}
                  onChange={e => setGithubMaxRepos(Math.max(1, Math.min(500, parseInt(e.target.value) || 100)))} />
              </div>
            </div>
            <button className="btn btn-primary" style={{ padding: 16, fontSize: 15 }}
              disabled={!githubUsername.trim() || status === "loading"}
              onClick={ingestGithub}>
              {status === "loading" ? "Scan GitHub et synchronisation du graphe..." : "Scanner le profil GitHub"}
            </button>
            {status === "loading" && (
              <div className="ingestion-progress-card" role="status" aria-live="polite">
                <div className="ingestion-progress-head">
                  <span className="ingestion-progress-spinner" aria-hidden="true" />
                  <div>
                    <strong>{githubUsername.trim() ? `Scan de @${githubUsername.trim()}` : "Scan GitHub"}</strong>
                    <span>Pas de timeout fixe ; la carte reste ouverte jusqu'à la réponse GitHub ou la fin de la synchro locale.</span>
                  </div>
                </div>
                <div className="ingestion-progress-track" aria-hidden="true"><span /></div>
                <div className="ingestion-progress-steps">
                  {githubProgressSteps.map(step => (
                    <div key={step}><span aria-hidden="true" />{step}</div>
                  ))}
                </div>
              </div>
            )}
            {githubResult && !githubResult.errorMsg && (
              <div className="card col gap-3" style={{ padding: 24 }}>
                <div className="row gap-3" style={{ alignItems: "center" }}>
                  {githubResult.github_user?.avatar
                    ? <img src={githubResult.github_user.avatar} alt="avatar" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
                    : <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--teal-soft)", color: "var(--teal)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                        {(githubResult.github_user?.login?.[0] ?? "?").toUpperCase()}
                      </div>
                  }
                  <div>
                    <div style={{ fontWeight: 600 }}>@{githubResult.github_user?.login}</div>
                    {githubResult.github_user?.bio && (
                      <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>{githubResult.github_user.bio}</div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "var(--ink-2)" }}>
                  {githubResult.stats?.repos_fetched ?? 0} repos trouvés - {githubResult.stats?.repos_enriched ?? 0} enrichis - {githubResult.stats?.projects_extracted ?? 0} projets extraits - {githubResult.stats?.skills_extracted ?? 0} compétences
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-4)", lineHeight: 1.5 }}>
                  Lecture de {githubResult.stats?.readmes_read ?? 0} README, {githubResult.stats?.languages_read ?? 0} cartes de langages et {githubResult.stats?.manifests_read ?? 0} manifestes.
                </div>
                {githubResult.errors?.length > 0 && (
                  <div style={{ fontSize: 13, color: "var(--ink-4)", lineHeight: 1.5 }}>{githubResult.errors[0]}</div>
                )}
              </div>
            )}
            {githubResult?.errorMsg && (
              <div style={{ padding: 16, background: "var(--bad-soft)", color: "var(--bad)", borderRadius: 12, border: "1px solid var(--bad)", fontSize: 14 }}>
                {githubResult.errorMsg}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "portfolio" && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="col gap-4">
            <div className="card col gap-4" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>URL de votre portfolio ou site personnel</h3>
              <input className="field-input" placeholder="https://yoursite.com" value={portfolioUrl}
                onChange={e => { setPortfolioUrl(e.target.value); setPortfolioResult(null); }} />
              <button className="btn btn-primary" style={{ alignSelf: "flex-start", padding: "10px 24px" }}
                disabled={!portfolioUrl.trim() || status === "loading"}
                onClick={() => scanPortfolio(false)}>
                {status === "loading" ? "Lecture du site..." : "Scanner le portfolio"}
              </button>
            </div>
            {portfolioResult?.errorMsg && (
              <div style={{ padding: 16, background: "var(--bad-soft)", color: "var(--bad)", borderRadius: 12, border: "1px solid var(--bad)", fontSize: 14 }}>
                {portfolioResult.errorMsg}
              </div>
            )}
            {portfolioResult && !portfolioResult.errorMsg && (
              <div className="card col gap-3" style={{ padding: 24 }}>
                {portfolioResult.screenshot_b64 && (
                  <img src={`data:image/png;base64,${portfolioResult.screenshot_b64}`} alt="Portfolio screenshot" style={{ maxHeight: 160, width: "100%", objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                )}
                {portfolioResult.candidate ? (
                  <>
                    <div style={{ fontSize: 14, color: "var(--ink-2)" }}>
                  {portfolioResult.stats?.pages_scanned ?? 0} pages scannées - {portfolioResult.stats?.skills ?? 0} compétences structurées - {portfolioResult.stats?.projects ?? 0} projets
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-4)", lineHeight: 1.5 }}>
                  {portfolioResult.stats?.links_seen ?? 0} liens lus et preuves brutes conservées{portfolioResult.stats?.llm_used ? " avec nettoyage IA." : " avec nettoyage déterministe."}
                    </div>
                    <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 14, background: "var(--paper-2)" }}>
                      {portfolioResult.candidate?.summary && (
                        <div style={{ marginBottom: 14 }}>
                          <div className="eyebrow" style={{ marginBottom: 6 }}>Résumé</div>
                          <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{portfolioResult.candidate.summary}</div>
                        </div>
                      )}
                      {(portfolioResult.skills || []).length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <div className="eyebrow" style={{ marginBottom: 8 }}>Compétences</div>
                          <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                            {portfolioResult.skills.map((skill: any, idx: number) => (
                              <span key={`${skill.name || skill.n}-${idx}`} className="pill" style={{ fontSize: 11 }}>{skill.name || skill.n}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(portfolioResult.projects || []).length > 0 && (
                        <div>
                          <div className="eyebrow" style={{ marginBottom: 8 }}>Projets</div>
                          <div className="col gap-2">
                            {portfolioResult.projects.map((project: any, idx: number) => (
                              <div key={`${project.title}-${idx}`} style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 8, background: "var(--paper)" }}>
                                <div style={{ fontWeight: 650, marginBottom: 4 }}>{project.title}</div>
                                {project.stack && <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>{project.stack}</div>}
                                {project.impact && <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{project.impact}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {portfolioResult.imported ? (
                      <div style={{ padding: 12, background: "var(--green-soft)", color: "var(--green-ink)", borderRadius: 8, border: "1px solid var(--green)", fontWeight: 600, lineHeight: 1.5 }}>
                        Importé : {portfolioResult.imported?.stats?.skills ?? 0} compétences - {portfolioResult.imported?.stats?.projects ?? 0} projets - {portfolioResult.imported?.stats?.experience ?? 0} expériences
                      </div>
                    ) : (
                      <button className="btn btn-primary" style={{ alignSelf: "flex-start", padding: "10px 24px" }}
                        disabled={status === "loading"}
                        onClick={importPortfolioResult}>
                        {status === "loading" ? "Import..." : "Importer les éléments affichés dans Profil"}
                      </button>
                    )}
                    {portfolioResult.importError && (
                      <div style={{ padding: 12, background: "var(--bad-soft)", color: "var(--bad)", borderRadius: 8, border: "1px solid var(--bad)", fontSize: 13 }}>
                        {portfolioResult.importError}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>
                    {portfolioResult.error || "Aucune donnée structurée n'a été extraite."}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "json-import" && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="col gap-4">
            <div className="card col gap-4" style={{ padding: 24 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>Collez votre profil JSON ici</h3>
                <button className="btn btn-ghost" style={{ fontSize: 13, padding: "8px 12px", flexShrink: 0 }}
                  onClick={downloadProfileTemplate}>
                  Télécharger le modèle
                </button>
              </div>
              <textarea className="field-input" value={jsonText}
                onChange={e => { setJsonText(e.target.value); setJsonError(null); setJsonResult(null); }}
                placeholder={`{\n  "candidate": { "name": "..." },\n  "skills": []\n}`}
                style={{ minHeight: 220, fontSize: 13, lineHeight: 1.6, fontFamily: "var(--font-mono)" }} />
              <button className="btn btn-primary" style={{ alignSelf: "flex-start", padding: "10px 24px" }}
                disabled={!jsonText.trim() || status === "loading"}
                onClick={importProfileJson}>
                {status === "loading" ? "Import..." : "Importer le profil"}
              </button>
            </div>
            {jsonError && (
              <div style={{ padding: 16, background: "var(--bad-soft)", color: "var(--bad)", borderRadius: 12, border: "1px solid var(--bad)", fontSize: 14 }}>
                {jsonError}
              </div>
            )}
            {jsonResult && (
              <div style={{
                padding: 16,
                background: jsonResult.status === "ok" ? "var(--green-soft)" : "var(--paper-3)",
                color: jsonResult.status === "ok" ? "var(--green-ink)" : "var(--ink-2)",
                borderRadius: 12,
                border: `1px solid ${jsonResult.status === "ok" ? "var(--green)" : "var(--line)"}`,
              }}>
                <div style={{ fontWeight: 600 }}>
                  Importé : {jsonResult.stats?.skills ?? 0} compétences - {jsonResult.stats?.experience ?? 0} expériences - {jsonResult.stats?.projects ?? 0} projets - {jsonResult.stats?.certifications ?? 0} certifications
                </div>
                {jsonResult.status === "partial" && (
                  <div style={{ fontSize: 13, marginTop: 4, color: "var(--ink-3)" }}>Certains éléments ont été ignorés.</div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "template" && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="col gap-4">
            <div className="card" style={{ padding: 24, background: "var(--purple-soft)", border: "1px solid var(--purple)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Modèle de CV</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
                Collez ici votre format de CV préféré (texte brut ou Markdown). Quand l'agent génère un CV adapté, il suit cette structure : ordre des sections, titres et mise en page, puis la remplit avec votre profil et les exigences de l'offre.
              </p>
            </div>
            <div className="card col gap-4" style={{ padding: 24 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>Contenu du modèle</span>
                {template && <span className="pill mono" style={{ fontSize: 10, background: "var(--green-soft)", color: "var(--green-ink)", border: "1px solid var(--green)" }}>Modèle enregistré</span>}
              </div>
              <textarea
                className="field-input"
                placeholder={`Collez votre modèle de CV ici. Par exemple :\n\n# [Nom]\n[Coordonnées]\n\n## Résumé\n[2-3 phrases de présentation]\n\n## Expérience\n### [Poste] - [Entreprise] ([Période])\n- [Points clés]\n\n## Projets\n### [Nom du projet]\n- Stack : ...\n- Impact : ...\n\n## Compétences\n[Liste séparée par des virgules]`}
                rows={24}
                value={template}
                onChange={e => setTemplate(e.target.value)}
                style={{ fontSize: 13, lineHeight: 1.65, fontFamily: "var(--font-mono)" }}
              />
              <div className="row gap-3" style={{ alignItems: "center" }}>
                <button className="btn btn-primary" style={{ padding: "12px 28px", fontSize: 14 }} onClick={saveTemplate} disabled={status==="loading"}>
                  {status === "loading" ? "Enregistrement..." : "Enregistrer le modèle"}
                </button>
                {template && (
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => { setTemplate(""); }}>
                    Effacer
                  </button>
                )}
                <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{template.length} caractères</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
