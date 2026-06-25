import { useState, type ChangeEvent } from "react";
import type { Cfg } from "./shared";
import { BigToggle, FRANCE_SOURCE_PRESET, GLOBAL_SOURCE_PRESET, INDIA_SOURCE_PRESET, LabelledField, SECRET_MASKS, SectionLabel } from "./shared";

export function DiscoverySettings({ cfg, set, onChange }: { cfg: Cfg; set: (k: keyof Cfg) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void; onChange: (k: keyof Cfg, v: string) => void }) {
  const [siteDraft, setSiteDraft] = useState("");

  const atsHosts = new Set(["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "smartrecruiters.com", "teamtailor.com"]);
  const isKnownAtsHost = (raw: string) => {
    const candidate = raw.startsWith("site:") ? raw.slice(5).split(/\s+/)[0] : raw;
    try {
      const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      return [...atsHosts].some(allowed => host === allowed || host.endsWith(`.${allowed}`));
    } catch {
      return false;
    }
  };

  const sourceTargetFromSite = (raw: string) => {
    const value = raw.trim().replace(/,$/, "");
    if (!value) return "";
    const lower = value.toLowerCase();
    if (/^(hn-hiring|site:|ats:|github:|hn:|reddit:|france_travail:|jobspy:|import:|https?:\/\/)/i.test(value)) {
      if (isKnownAtsHost(lower)) {
        return value;
      }
      return value;
    }
    const domain = value.replace(/^www\./i, "").replace(/\/+$/, "");
    return `site:${domain} ("jobs" OR "careers" OR "hiring" OR "open roles") (remote OR hybrid OR onsite OR France OR global)`;
  };

  const addSiteSource = () => {
    const target = sourceTargetFromSite(siteDraft);
    if (!target || cfg.job_boards.includes(target)) return;
    const sep = cfg.job_boards.trim() ? ",\n" : "";
    onChange("job_boards", cfg.job_boards.trim() + sep + target);
    setSiteDraft("");
  };

  return (
    <>
{/* 3. Sources */}
          <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 18 }}>
            <SectionLabel label="Sources et découverte" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <LabelledField label="Postes ou intitulés ciblés" hint="facultatif ; le graphe profil reste prioritaire">
                <textarea value={cfg.desired_position || cfg.onboarding_target_role || ""} onChange={e => {
                  onChange("desired_position", e.target.value);
                  onChange("onboarding_target_role", e.target.value);
                }} rows={3} className="mono field-input"
                  placeholder={"Développeur backend\nChef de projet digital\nCommercial B2B"}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 11.5, resize: "vertical", lineHeight: 1.6 }} />
              </LabelledField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <LabelledField label="Token Apify" hint="optionnel, pour scraping LinkedIn/X">
                  <input type="password" placeholder="apify_api_***" value={cfg.apify_token} onChange={set("apify_token")} className="mono field-input"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                </LabelledField>
                <LabelledField label="Actor Apify" hint="actor à exécuter">
                  <input type="text" placeholder="drobnikj/..." value={cfg.apify_actor} onChange={set("apify_actor")} className="mono field-input"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                </LabelledField>
              </div>
              <LabelledField label="Cookie de session LinkedIn" hint="valeur li_at">
                <input type="password" placeholder="li_at=***" value={cfg.linkedin_cookie} onChange={set("linkedin_cookie")} className="mono field-input"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
              </LabelledField>
              <div style={{ padding: 13, borderRadius: 13, background: "var(--paper-2)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionLabel label="Recherche de contacts" sub="emails Hunter.io, LinkedIn Proxycurl optionnel" />
                <BigToggle
                  active={cfg.contact_lookup_enabled !== "false"}
                  onToggle={() => onChange("contact_lookup_enabled", cfg.contact_lookup_enabled === "false" ? "true" : "false")}
                  icon="user"
                  label="Contact à privilégier"
                  badge={cfg.contact_lookup_enabled !== "false" ? "on" : "off"}
                  sub="Après génération du dossier, ajoute le meilleur contact trouvé à l'offre"
                  tone="blue"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <LabelledField label="Clé API Hunter.io" hint="recherche par domaine">
                    <input type="password" placeholder="hunter key" value={cfg.hunter_api_key} onChange={set("hunter_api_key")} className="mono field-input"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                  </LabelledField>
                  <LabelledField label="Clé API Proxycurl" hint="résolution LinkedIn optionnelle">
                    <input type="password" placeholder="proxycurl key" value={cfg.proxycurl_api_key} onChange={set("proxycurl_api_key")} className="mono field-input"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                  </LabelledField>
                </div>
              </div>

              <div style={{ padding: 13, borderRadius: 13, background: "var(--paper-2)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionLabel label="Signaux X" sub="posts récents pouvant signaler une offre" />
                <LabelledField label="Bearer token X" hint="token de la console développeur">
                  <input type="password" placeholder="Bearer token" value={cfg.x_bearer_token} onChange={set("x_bearer_token")} className="mono field-input"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                </LabelledField>
                <LabelledField label="Requêtes X recent-search" hint="une requête par ligne ; vide = valeurs IA par défaut">
                  <textarea value={cfg.x_search_queries} onChange={set("x_search_queries")} rows={4} className="mono field-input"
                    placeholder={[
                      "(\"hiring\" OR \"job opening\" OR \"open role\") (\"marketing\" OR \"sales\" OR \"operations\" OR \"developer\") lang:en -is:retweet",
                      "(\"we are hiring\" OR \"is hiring\") (\"remote\" OR \"hybrid\" OR \"India\" OR \"global\") lang:en -is:retweet",
                      "(\"apply\" OR \"open role\") (\"entry level\" OR \"associate\" OR \"manager\" OR \"specialist\") lang:en -is:retweet",
                    ].join("\n")}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 11.5, resize: "vertical", lineHeight: 1.6 }} />
                </LabelledField>
                <LabelledField label="Comptes X à surveiller" hint="un fondateur, recruteur ou compte entreprise par ligne">
                  <textarea value={cfg.x_watchlist} onChange={set("x_watchlist")} rows={3} className="mono field-input"
                    placeholder={"@target_company\n@founder_or_hiring_team\n@job_board_handle"}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 11.5, resize: "vertical", lineHeight: 1.6 }} />
                </LabelledField>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
                  <LabelledField label="Requêtes" hint="par scan">
                    <input type="number" min={1} max={50} value={cfg.x_max_requests_per_scan} onChange={set("x_max_requests_per_scan")} className="mono field-input"
                      style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                  </LabelledField>
                  <LabelledField label="Posts" hint="par requête">
                    <input type="number" min={10} max={100} value={cfg.x_max_results_per_query} onChange={set("x_max_results_per_query")} className="mono field-input"
                      style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                  </LabelledField>
                  <LabelledField label="Signal min." hint="0-100">
                    <input type="number" min={0} max={100} value={cfg.x_min_signal_score} onChange={set("x_min_signal_score")} className="mono field-input"
                      style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                  </LabelledField>
                  <LabelledField label="Score chaud" hint="0-100">
                    <input type="number" min={1} max={100} value={cfg.x_hot_lead_threshold} onChange={set("x_hot_lead_threshold")} className="mono field-input"
                      style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                  </LabelledField>
                </div>
                <BigToggle
                  active={cfg.x_enable_notifications === "true"}
                  onToggle={() => onChange("x_enable_notifications", cfg.x_enable_notifications === "true" ? "false" : "true")}
                  icon="spark"
                  label="Notifications X prioritaires"
                  badge={cfg.x_enable_notifications === "true" ? "on" : "off"}
                  sub="Alerte desktop quand une offre X dépasse le score chaud"
                  tone="orange"
                />
              </div>
              <div style={{ padding: 13, borderRadius: 13, background: "var(--paper-2)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionLabel label="Sources gratuites" sub="France Travail, ATS, GitHub, HN et Reddit" />
                <BigToggle
                  active={cfg.free_sources_enabled !== "false"}
                  onToggle={() => onChange("free_sources_enabled", cfg.free_sources_enabled === "false" ? "true" : "false")}
                  icon="search"
                  label="Scans gratuits"
                  badge={cfg.free_sources_enabled !== "false" ? "on" : "off"}
                  sub="Activé par défaut ; enregistre les offres et classe leur niveau pour le filtrage"
                  tone="green"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <LabelledField label="Client ID France Travail" hint="API Offres d'emploi">
                    <input type="password" placeholder="client_id" value={SECRET_MASKS.has(cfg.france_travail_client_id) ? "" : cfg.france_travail_client_id} onChange={set("france_travail_client_id")} className="mono field-input"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                  </LabelledField>
                  <LabelledField label="Secret France Travail" hint="conservé masqué après sauvegarde">
                    <input type="password" placeholder="client_secret" value={SECRET_MASKS.has(cfg.france_travail_client_secret) ? "" : cfg.france_travail_client_secret} onChange={set("france_travail_client_secret")} className="mono field-input"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                  </LabelledField>
                </div>
                <LabelledField label="Entreprises à surveiller" hint="fournisseur,slug par ligne : greenhouse,<slug-entreprise>">
                  <textarea value={cfg.company_watchlist} onChange={set("company_watchlist")} rows={4} className="mono field-input"
                    placeholder={[
                      "greenhouse,<company-slug>",
                      "lever,<company-slug>",
                      "ashby,<company-slug>",
                      "workable,<company-slug>",
                      "https://careers.<company-domain>/jobs",
                    ].join("\n")}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 11.5, resize: "vertical", lineHeight: 1.6 }} />
                </LabelledField>
                <LabelledField label="Cibles de sources gratuites" hint="france_travail:, import:, github:, hn:, reddit: ou ats:">
                  <textarea value={cfg.free_source_targets} onChange={set("free_source_targets")} rows={5} className="mono field-input"
                    placeholder={[
                      "github:<target role> hiring help wanted",
                      "hn:<target role> remote hiring",
                      "reddit:forhire:<target role> hiring remote",
                      "ats:greenhouse:<company-slug>",
                    ].join("\n")}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 11.5, resize: "vertical", lineHeight: 1.6 }} />
                </LabelledField>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                  <LabelledField label="Requêtes gratuites" hint="par scan">
                    <input type="number" min={1} max={80} value={cfg.free_source_max_requests} onChange={set("free_source_max_requests")} className="mono field-input"
                      style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                  </LabelledField>
                  <LabelledField label="Signal gratuit min." hint="0-100">
                    <input type="number" min={0} max={100} value={cfg.free_source_min_signal_score} onChange={set("free_source_min_signal_score")} className="mono field-input"
                      style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 12 }} />
                  </LabelledField>
                </div>
              </div>
              <div style={{ padding: 13, borderRadius: 13, background: "var(--paper-2)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionLabel label="Connecteurs personnalisés" sub="APIs JSON privées ou premium normalisées en offres" />
                <BigToggle
                  active={cfg.custom_connectors_enabled === "true"}
                  onToggle={() => onChange("custom_connectors_enabled", cfg.custom_connectors_enabled === "true" ? "false" : "true")}
                  icon="layers"
                  label="Scan des connecteurs"
                  badge={cfg.custom_connectors_enabled === "true" ? "on" : "off"}
                  sub="Pour outils payants, flux internes, APIs d'emploi privées et fournisseurs premium"
                  tone="purple"
                />
                <LabelledField label="Définitions des connecteurs" hint="tableau JSON ; pas de secret ici">
                  <textarea value={cfg.custom_connectors} onChange={set("custom_connectors")} rows={9} className="mono field-input"
                    placeholder={JSON.stringify([
                      {
                        name: "JobFeed",
                        url: "https://jobs-api.your-domain.test/jobs",
                        method: "GET",
                        items_path: "jobs",
                        fields: {
                          title: "title",
                          company: "company.name",
                          url: "apply_url",
                          description: "description",
                          posted_date: "posted_at",
                          location: "location",
                          budget: "salary",
                        },
                      },
                    ], null, 2)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 11.5, resize: "vertical", lineHeight: 1.6 }} />
                </LabelledField>
                <LabelledField label="Headers des connecteurs" hint="objet JSON ; sensible, conservé si masqué">
                  <textarea value={cfg.custom_connector_headers} onChange={set("custom_connector_headers")} rows={5} className="mono field-input"
                    placeholder={JSON.stringify({
                      JobFeed: {
                        Authorization: "Bearer YOUR_TOKEN",
                        "X-API-Key": "optional-key",
                      },
                    }, null, 2)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 11.5, resize: "vertical", lineHeight: 1.6 }} />
                </LabelledField>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45 }}>
                  Chaque connecteur récupère du JSON, lit <span className="mono">items_path</span>, mappe les champs, puis envoie les offres dans le même filtre qualité. Gardez les tokens dans les headers, pas dans les définitions.
                </div>
              </div>
              <LabelledField label="Jobboards / URLs de recherche ciblés" hint="séparés par des virgules">
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Marché ciblé</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { id: "france", label: "Marché français", sub: "France Travail, ATS et jobboards français" },
                      { id: "global", label: "International", sub: "Jobboards mondiaux, ATS, flux remote et sources généralistes" },
                      { id: "india", label: "Marché indien", sub: "Jobboards indiens, startups locales, ATS et offres remote India" },
                    ].map(mode => {
                      const active = (cfg.job_market_focus || "global") === mode.id;
                      return (
                        <button key={mode.id} onClick={() => onChange("job_market_focus", mode.id)} style={{
                          textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                          background: active ? "var(--blue-soft)" : "var(--paper-3)",
                          border: `1.5px solid ${active ? "var(--blue)" : "var(--line)"}`,
                          color: active ? "var(--blue-ink)" : "var(--ink-2)",
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{mode.label}</div>
                          <div style={{ fontSize: 11, marginTop: 3, lineHeight: 1.35, color: "var(--ink-3)" }}>{mode.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, marginBottom: 10 }}>
                    <input
                      className="mono field-input"
                      value={siteDraft}
                      onChange={e => setSiteDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSiteSource();
                        }
                      }}
                      placeholder="Collez un jobboard, un ATS, une URL RSS/API ou un domaine"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 11.5 }}
                    />
                    <button className="btn btn-accent" onClick={addSiteSource} disabled={!siteDraft.trim()} style={{ minWidth: 110, justifyContent: "center" }}>
                      Ajouter
                    </button>
                  </div>
                  {siteDraft.trim() && (
                    <div className="mono" style={{ marginBottom: 10, color: "var(--ink-3)", fontSize: 10.5, lineHeight: 1.45 }}>
                      Sera ajouté : {sourceTargetFromSite(siteDraft)}
                    </div>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Ajout rapide</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {[
                      { label: "Preset international", url: GLOBAL_SOURCE_PRESET },
                      { label: "Preset France", url: FRANCE_SOURCE_PRESET },
                      { label: "Preset Inde", url: INDIA_SOURCE_PRESET },
                      { label: "HN Hiring", url: "hn-hiring" },
                      { label: "RemoteOK", url: "https://remoteok.com/api" },
                      { label: "LinkedIn", url: "site:linkedin.com/jobs" },
                      { label: "Indeed", url: "site:indeed.com/jobs" },
                      { label: "France Travail", url: "france_travail:developpeur;lieu=France;range=0-49" },
                      { label: "WTTJ", url: "site:welcometothejungle.com/fr/jobs France" },
                      { label: "HelloWork", url: "site:hellowork.com/fr-fr/emplois France" },
                      { label: "Apec", url: "site:apec.fr/candidat/recherche-emploi.html/emploi France" },
                      { label: "Cadremploi", url: "site:cadremploi.fr/emploi France" },
                      { label: "Meteojob", url: "site:meteojob.com/jobs France" },
                      { label: "LesJeudis", url: "site:lesjeudis.com/jobs France" },
                      { label: "Indeed FR", url: "site:fr.indeed.com/emplois France" },
                      { label: "SmartRecruiters", url: "site:jobs.smartrecruiters.com France" },
                      { label: "Teamtailor", url: "site:teamtailor.com/jobs France" },
                      { label: "Naukri", url: "site:naukri.com jobs India" },
                      { label: "Instahyre", url: "site:instahyre.com jobs India" },
                      { label: "Cutshort", url: "site:cutshort.io/jobs India startup" },
                      { label: "Foundit", url: "site:foundit.in jobs India" },
                      { label: "Internshala", url: "site:internshala.com/jobs India" },
                      { label: "Greenhouse", url: "site:boards.greenhouse.io" },
                      { label: "Lever", url: "site:jobs.lever.co" },
                      { label: "Ashby", url: "site:jobs.ashbyhq.com" },
                      { label: "Workable", url: "site:apply.workable.com" },
                      { label: "Wellfound", url: "site:wellfound.com/jobs" },
                      { label: "WWR", url: "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss" },
                      { label: "Remotive All", url: "https://remotive.com/api/remote-jobs" },
                      { label: "Jobicy All", url: "https://jobicy.com/api/v2/remote-jobs?count=50" },
                      { label: "Jobicy", url: "https://jobicy.com/feed/newjobs" },
                    ].map(p => {
                      const already = cfg.job_boards.includes(p.url);
                      return (
                        <button key={p.label} onClick={() => {
                          if (already) return;
                          const sep = cfg.job_boards.trim() ? ",\n" : "";
                          if (p.label === "Preset France") onChange("job_market_focus", "france");
                          if (p.label === "Preset Inde") onChange("job_market_focus", "india");
                          if (p.label === "Preset international") onChange("job_market_focus", "global");
                          onChange("job_boards", cfg.job_boards.trim() + sep + p.url);
                        }} style={{
                          padding: "4px 10px", borderRadius: 7, fontSize: 10.5, cursor: already ? "default" : "pointer",
                          fontWeight: 600, transition: "all .12s ease",
                          background: already ? "var(--blue-soft)" : "var(--paper-3)",
                          color: already ? "var(--blue-ink)" : "var(--ink-2)",
                          border: `1px solid ${already ? "var(--blue)" : "var(--line)"}`,
                          opacity: already ? 0.7 : 1,
                        }}>
                          {already ? "Ajouté " : "+ "}{p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <textarea value={cfg.job_boards} onChange={set("job_boards")} rows={5} className="mono field-input"
                  placeholder={[
                    "# Sources France stables / best effort",
                    "france_travail:developpeur;lieu=France;range=0-49,",
                    "# Hacker News Who is Hiring (Algolia API)",
                    "hn-hiring,",
                    "# APIs directes / flux RSS",
                    "https://remoteok.com/api,",
                    "https://remotive.com/api/remote-jobs,",
                    "https://jobicy.com/api/v2/remote-jobs?count=50,",
                    "https://jobicy.com/feed/newjobs,",
                    "https://weworkremotely.com/remote-jobs.rss,",
                    "# ATS et jobboards (les requêtes sont adaptées à votre profil)",
                    "site:boards.greenhouse.io,",
                    "site:jobs.lever.co,",
                    "site:jobs.ashbyhq.com,",
                    "site:apply.workable.com,",
                    "site:wellfound.com/jobs,",
                    "site:linkedin.com/jobs,",
                    "site:indeed.com/jobs,",
                    "site:naukri.com jobs India,",
                  ].join("\n")}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", fontSize: 11.5, resize: "vertical", lineHeight: 1.6 }} />
              </LabelledField>
            </div>
          </div>
    </>
  );
}
