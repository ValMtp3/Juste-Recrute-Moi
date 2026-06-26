import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import Icon from "../../shared/components/Icon";
import type { ApiFetch, GraphStats, View } from "../../types";
import { applyProfileDeleteMarkers, entryTitle, mergeProfileWithGraphFallback, normalizeProfileResponse, profileDeleteKey, profileDeletePath, profileHasDeleteMarker, removeProfileItem, type ProfileDeleteMarker } from "./profileUtils";
import { emitAppEvent, onAppEvent } from "../../shared/lib/appEvents";

type ProfileData = ReturnType<typeof normalizeProfileResponse>;
type ProfileRecord = Record<string, unknown>;

const asRecord = (value: unknown): ProfileRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value as ProfileRecord : {};

const textValue = (value: unknown): string => String(value || "");

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

const detailFromBody = (body: unknown): string => {
  const detail = asRecord(body).detail;
  return typeof detail === "string" ? detail : "";
};

const stackItems = (stack: unknown): string[] =>
  (Array.isArray(stack) ? stack : String(stack || "").split(","))
    .map(s => String(s).trim())
    .filter(Boolean);

const EMPTY_PROFILE_LIST: unknown[] = [];
const profileList = (value: unknown): unknown[] => Array.isArray(value) ? value : EMPTY_PROFILE_LIST;

export function ProfileView({ api, setView, stats }: { api: ApiFetch; setView: (v: View) => void; stats?: GraphStats }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<ProfileRecord | null>(null);
  const [editingCandidate, setEditingCandidate] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [candForm, setCandForm] = useState({ n: "", s: "" });
  const [identityForm, setIdentityForm] = useState({ email: "", phone: "", linkedin_url: "", github_url: "", website_url: "", city: "" });
  const [activeProfileTab, setActiveProfileTab] = useState<"skills" | "experience" | "projects" | "education" | "certifications" | "achievements">("skills");
  const [expandedProfileList, setExpandedProfileList] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ key: string; label: string } | null>(null);
  const [cleaningProfile, setCleaningProfile] = useState(false);
  const [confirmCleanupOpen, setConfirmCleanupOpen] = useState(false);
  const deleteMarkersRef = useRef<ProfileDeleteMarker[]>([]);
  const deleteInFlightRef = useRef(false);

  const setDeleteMarkerList = useCallback((markers: ProfileDeleteMarker[]) => {
    deleteMarkersRef.current = markers;
  }, []);

  const addDeleteMarker = useCallback((marker: ProfileDeleteMarker) => {
    const exists = deleteMarkersRef.current.some(item => item.type === marker.type && item.id === marker.id);
    if (exists) return deleteMarkersRef.current;
    const next = [...deleteMarkersRef.current, marker];
    setDeleteMarkerList(next);
    return next;
  }, [setDeleteMarkerList]);

  const removeDeleteMarker = useCallback((marker: ProfileDeleteMarker) => {
    const next = deleteMarkersRef.current.filter(item => item.type !== marker.type || item.id !== marker.id);
    setDeleteMarkerList(next);
  }, [setDeleteMarkerList]);

  const applyLocalDeletes = useCallback((nextProfile: unknown, pruneResolved = false) => {
    const markers = deleteMarkersRef.current;
    if (!markers.length) return normalizeProfileResponse(nextProfile);
    const resolved = pruneResolved ? markers.filter(marker => profileHasDeleteMarker(nextProfile, marker)) : markers;
    if (resolved.length !== markers.length) {
      setDeleteMarkerList(resolved);
    }
    return applyProfileDeleteMarkers(nextProfile, resolved);
  }, [setDeleteMarkerList]);

  const fetchProfile = useCallback(async (options?: { errorPrefix?: string; suppressError?: boolean }) => {
    try {
      const r = await api(`/api/v1/profile`);
      if (!r.ok) throw new Error(`Chargement du profil échoué (${r.status})`);
      const data = await r.json();
      setProfile(applyLocalDeletes(mergeProfileWithGraphFallback(data, stats), true));
      setProfileErr(null);
      setProfileNotice(null);
      return true;
    } catch (err: unknown) {
      console.error("Chargement du profil échoué :", err);
      const message = errorMessage(err, "Chargement du profil échoué");
      if (!options?.suppressError) {
        setProfileErr(options?.errorPrefix ? `${options.errorPrefix}: ${message}` : message);
      }
      return false;
    }
  }, [api, applyLocalDeletes, stats]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => {
    setProfile(prev => prev ? applyLocalDeletes(mergeProfileWithGraphFallback(prev, stats, { fillEmptyBuckets: false })) : prev);
  }, [applyLocalDeletes, stats]);
  useEffect(() => {
    const onProfileRefresh = () => { void fetchProfile(); };
    return onAppEvent("profile-refresh", onProfileRefresh);
  }, [fetchProfile]);
  useEffect(() => { setExpandedProfileList(false); }, [activeProfileTab]);
  useEffect(() => {
    const exportProfile = async () => {
      if (!profile) return;
      const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      // WebKitGTK (Tauri's Linux webview) silently ignores programmatic
      // `<a download>` clicks, so the anchor approach never produces a file
      // there — the button looked dead on Linux (issue #92). Inside the Tauri
      // shell, hand the blob to the system opener instead, the same path the
      // resume "Download PDF" button already uses on every desktop platform.
      // Fall back to a real download anchor in a plain browser (dev).
      const inTauri = typeof window !== "undefined"
        && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
      if (inTauri) {
        try {
          await openUrl(url);
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        }
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `${profile.n || "identity-graph"}.json`.replace(/[^\w.-]+/g, "-");
      a.click();
      URL.revokeObjectURL(url);
    };
    window.addEventListener("profile-export", exportProfile);
    return () => window.removeEventListener("profile-export", exportProfile);
  }, [profile]);

  const deleteItem = useCallback(async (type: string, id: string) => {
    const key = `${type}:${id}`;
    if (!id || deleteInFlightRef.current) return;
    const marker = { type, id };
    deleteInFlightRef.current = true;
    setDeletingItem({ key, label: id });
    setProfileErr(null);
    try {
      const res = await api(profileDeletePath(type, id), { method: "DELETE", timeoutMs: 120000 });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(detailFromBody(body) || `Suppression échouée (${res.status})`);
      const markers = addDeleteMarker(marker);
      setProfile(prev => prev ? applyProfileDeleteMarkers(removeProfileItem(prev, type, id), markers) : prev);
      const refreshed = await fetchProfile({ suppressError: true });
      if (!refreshed) {
        setProfileErr("Élément supprimé, mais le profil n'a pas pu être rechargé. Il reste masqué localement.");
      } else {
        setProfileErr(null);
      }
      emitAppEvent("graph-refresh");
    } catch (err: unknown) {
      console.error("Delete error:", err);
      removeDeleteMarker(marker);
      setProfileErr(errorMessage(err, "Suppression échouée"));
    } finally {
      deleteInFlightRef.current = false;
      setDeletingItem(null);
    }
  }, [api, addDeleteMarker, fetchProfile, removeDeleteMarker]);

  const saveEdit = async (type: string, id: string) => {
    if (!id) {
      setProfileErr("Cette ligne de profil doit avoir un identifiant de graphe pour être modifiée. Supprimez-la ou réimportez le profil.");
      return;
    }
    try {
      const res = await api(`/api/v1/profile/${type}/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editData || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(detailFromBody(body) || `Enregistrement échoué (${res.status})`);
      setEditId(null);
      setEditData(null);
      setProfileErr(null);
      await fetchProfile();
      emitAppEvent("profile-refresh");
      emitAppEvent("graph-refresh");
    } catch (err: unknown) {
      setProfileErr(errorMessage(err, "L'enregistrement du profil a échoué"));
    }
  };

  const saveCandidate = async () => {
    try {
      const res = await api(`/api/v1/profile/candidate`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(candForm),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(detailFromBody(body) || `Enregistrement échoué (${res.status})`);
      const bodyRecord = asRecord(body);
      setProfile(prev => normalizeProfileResponse({ ...asRecord(prev), n: bodyRecord.n ?? candForm.n, s: bodyRecord.s ?? candForm.s }));
      setEditingCandidate(false);
      setProfileErr(null);
      await fetchProfile({ errorPrefix: "Contexte d'identité enregistré, mais le rafraîchissement a échoué" });
      emitAppEvent("profile-refresh");
      emitAppEvent("graph-refresh");
    } catch (err: unknown) {
      setProfileErr(errorMessage(err, "L'enregistrement du contexte d'identité a échoué"));
    }
  };

  const saveIdentity = async () => {
    try {
      const res = await api(`/api/v1/profile/identity`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(identityForm),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(detailFromBody(body) || `Enregistrement échoué (${res.status})`);
      setProfile(prev => {
        const prevRecord = asRecord(prev);
        return normalizeProfileResponse({ ...prevRecord, identity: { ...asRecord(prevRecord.identity), ...asRecord(body) } });
      });
      setEditingIdentity(false);
      setProfileErr(null);
      await fetchProfile({ errorPrefix: "Coordonnées enregistrées, mais le rafraîchissement a échoué" });
      emitAppEvent("profile-refresh");
      emitAppEvent("graph-refresh");
    } catch (err: unknown) {
      setProfileErr(errorMessage(err, "L'enregistrement du contact a échoué"));
    }
  };

  const cleanupProfile = async () => {
    setCleaningProfile(true);
    setConfirmCleanupOpen(false);
    setProfileErr(null);
    setProfileNotice(null);
    try {
      const res = await api(`/api/v1/profile/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "CLEAN" }),
        timeoutMs: 120000,
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 404) {
        throw new Error("Le backend actif ne connaît pas encore le nettoyage du profil. Relancez l'application ou le backend local pour charger la nouvelle route.");
      }
      if (!res.ok) throw new Error(detailFromBody(body) || `Nettoyage échoué (${res.status})`);
      const bodyRecord = asRecord(body);
      const cleanedProfile = bodyRecord.profile ? mergeProfileWithGraphFallback(bodyRecord.profile, stats, { fillEmptyBuckets: false }) : profile;
      setProfile(applyLocalDeletes(cleanedProfile, true));
      const cleanupStats = asRecord(bodyRecord.stats);
      const removed = Number(cleanupStats.removed || 0) + Number(cleanupStats.deduplicated || 0);
      const corrected = Number(cleanupStats.corrected || 0);
      const purged = Number(cleanupStats.purged_graph || 0);
      await fetchProfile({ suppressError: true });
      setProfileNotice(`Nettoyage terminé : ${removed} doublon(s)/ligne(s) vide(s) retiré(s), ${corrected} correction(s) appliquée(s), ${purged} noeud(s) graphe purgé(s).`);
      emitAppEvent("graph-refresh");
    } catch (err: unknown) {
      setProfileErr(errorMessage(err, "Le nettoyage du profil a échoué"));
    } finally {
      setCleaningProfile(false);
    }
  };

  const skills = useMemo(() => profileList(profile?.skills), [profile?.skills]);
  const exp = useMemo(() => profileList(profile?.exp), [profile?.exp]);
  const projects = useMemo(() => profileList(profile?.projects), [profile?.projects]);
  const education = useMemo(() => profileList(profile?.education), [profile?.education]);
  const certifications = useMemo(() => profileList(profile?.certifications), [profile?.certifications]);
  const achievements = useMemo(() => profileList(profile?.achievements), [profile?.achievements]);
  const identity = profile?.identity || {};
  const identityItems = [
    ["email", identity.email, "mail"],
    ["phone", identity.phone, "phone"],
    ["linkedin_url", identity.linkedin_url, "external-link"],
    ["github_url", identity.github_url, "external-link"],
    ["website_url", identity.website_url, "globe"],
    ["city", identity.city, "globe"],
  ].filter(([, value]) => String(value || "").trim());
  const evidenceCount = skills.length + exp.length + projects.length + education.length + certifications.length + achievements.length + identityItems.length;
  const topStacks = Array.from(new Set<string>(projects.flatMap(p => stackItems(asRecord(p).stack)))).slice(0, 10);
  const visibleStacks = topStacks.slice(0, 6);
  const summary = String(profile?.s || "").replace(/\s+/g, " ").trim();
  const summaryPreview = summary
    ? summary.length > 265 ? `${summary.slice(0, 262).trim()}...` : summary
    : "Ajoutez votre nom et un résumé du rôle cible. Ce texte sert d'ancrage au scoring et à la génération des dossiers.";
  const skillItems = useMemo(() => {
    const seen = new Set<string>();
    return skills
      .map(s => {
        const item = asRecord(s);
        const label = textValue(item.n || item.name || item.title).trim();
        const id = textValue(item.id).trim();
        const key = (id || label).toLowerCase();
        if (!label || seen.has(key)) return null;
        seen.add(key);
        return { label, cat: textValue(item.cat || item.category || "general"), id };
      })
      .filter(Boolean) as { label: string; cat: string; id: string }[];
  }, [skills]);
  const previewSkills = expandedProfileList ? skillItems : skillItems.slice(0, 10);
  const previewExp = expandedProfileList ? exp : exp.slice(0, 6);
  const previewProjects = expandedProfileList ? projects : projects.slice(0, 8);
  const previewEducation = expandedProfileList ? education : education.slice(0, 8);
  const previewCertifications = expandedProfileList ? certifications : certifications.slice(0, 8);
  const previewAchievements = expandedProfileList ? achievements : achievements.slice(0, 8);
  const listTotal = activeProfileTab === "skills" ? skillItems.length : activeProfileTab === "experience" ? exp.length : activeProfileTab === "projects" ? projects.length : activeProfileTab === "education" ? education.length : activeProfileTab === "certifications" ? certifications.length : achievements.length;
  const listShown = activeProfileTab === "skills" ? previewSkills.length : activeProfileTab === "experience" ? previewExp.length : activeProfileTab === "projects" ? previewProjects.length : activeProfileTab === "education" ? previewEducation.length : activeProfileTab === "certifications" ? previewCertifications.length : previewAchievements.length;
  const deletingKey = deletingItem?.key || "";
  const isDeleting = Boolean(deletingItem);
  const isDeletingKey = (key: string) => deletingKey === key;
  const editField = (key: string) => textValue(editData?.[key]);
  const setEditField = (key: string, value: string) => setEditData(prev => ({ ...asRecord(prev), [key]: value }));
  const deleteButtonTitle = (key: string, label: string) =>
    isDeletingKey(key) ? `Suppression de ${label}` : isDeleting ? "Attendez la fin de la suppression en cours" : `Supprimer ${label}`;
  const deleteButtonContent = (key: string) =>
    isDeletingKey(key) ? <span className="spinner-sm profile-delete-spinner" aria-hidden="true" /> : <Icon name="trash" size={14} />;
  const deleteStatus = (key: string) => isDeletingKey(key) ? (
    <span className="profile-delete-status"><span className="spinner-sm profile-delete-spinner" aria-hidden="true" /> Suppression...</span>
  ) : null;
  const tabNodes = [
    { id: "skills" as const, label: "Compétences", count: skills.length, tone: "blue", icon: "spark" },
    { id: "experience" as const, label: "Expériences", count: exp.length, tone: "orange", icon: "brief" },
    { id: "projects" as const, label: "Projets", count: projects.length, tone: "pink", icon: "layers" },
    { id: "education" as const, label: "Éducation", count: education.length, tone: "green", icon: "file" },
    { id: "certifications" as const, label: "Certifications", count: certifications.length, tone: "purple", icon: "check" },
    { id: "achievements" as const, label: "Réussites", count: achievements.length, tone: "yellow", icon: "trending" },
  ];

  return (
    <div className="scroll profile-page">
      <div className="profile-shell profile-shell-compact">
        {profileErr && (
          <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "var(--bad-soft)", border: "1px solid var(--bad)", color: "var(--bad)", fontSize: 13 }}>
            {profileErr}
          </div>
        )}
        {profileNotice && (
          <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "var(--ok-soft)", border: "1px solid var(--ok)", color: "var(--ok)", fontSize: 13 }}>
            {profileNotice}
          </div>
        )}
        <div className="profile-workspace">
          <aside className="profile-left-rail">
            <div className="card profile-identity-card">
              <div className="profile-identity-head">
                <div className="profile-avatar">{(profile?.n || "C").slice(0, 1).toUpperCase()}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className="eyebrow">Contexte d'identité</span>
                  <h1 className="profile-name">{profile?.n || "Profil candidat"}</h1>
                </div>
                {!editingCandidate && (
                  <button className="btn profile-edit-btn" onClick={() => { setEditingCandidate(true); setCandForm({ n: profile?.n || "", s: profile?.s || "" }); }}>
                    <Icon name="edit" size={13} /> Modifier
                  </button>
                )}
              </div>

          {editingCandidate ? (
            <div className="col gap-3" style={{ marginTop: 18 }}>
              <input className="field-input" placeholder="Votre nom complet" value={candForm.n} onChange={e => setCandForm({ ...candForm, n: e.target.value })} style={{ fontSize: 18, fontWeight: 600 }} />
              <textarea className="field-input" placeholder="Résumé professionnel / poste cible - utilisé pour le scoring" rows={4} value={candForm.s} onChange={e => setCandForm({ ...candForm, s: e.target.value })} style={{ fontSize: 14, lineHeight: 1.6 }} />
              <div className="row gap-2">
                <button className="btn btn-primary" style={{ padding: "10px 24px" }} onClick={saveCandidate}>Enregistrer l'identité</button>
                <button className="btn btn-ghost" onClick={() => setEditingCandidate(false)}>Annuler</button>
              </div>
            </div>
          ) : (
            <>
              <p className="profile-summary">{summaryPreview}</p>
              {identityItems.length > 0 && (
                <div className="profile-contact-list">
                  {identityItems.slice(0, 6).map(([key, value, icon]) => {
                    const text = String(value || "");
                    const isUrl = /^https?:\/\//i.test(text);
                    return (
                      <div key={String(key)} className="profile-contact-item">
                        <Icon name={String(icon)} size={12} />
                        {isUrl ? <a href={text} target="_blank" rel="noreferrer">{text.replace(/^https?:\/\//i, "")}</a> : <span>{text}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="profile-pill-row">
                <span className="pill mono">{skills.length} COMPÉTENCES</span>
                <span className="pill mono">{exp.length} RÔLES</span>
                <span className="pill mono">{projects.length} PROJETS</span>
              </div>
              {editingIdentity ? (
                <div className="col gap-2" style={{ marginTop: 14 }}>
                  <input className="field-input" placeholder="Email" value={identityForm.email} onChange={e => setIdentityForm({ ...identityForm, email: e.target.value })} />
                   <input className="field-input" placeholder="Téléphone" value={identityForm.phone} onChange={e => setIdentityForm({ ...identityForm, phone: e.target.value })} />
                  <input className="field-input" placeholder="LinkedIn URL" value={identityForm.linkedin_url} onChange={e => setIdentityForm({ ...identityForm, linkedin_url: e.target.value })} />
                  <input className="field-input" placeholder="GitHub URL" value={identityForm.github_url} onChange={e => setIdentityForm({ ...identityForm, github_url: e.target.value })} />
                   <input className="field-input" placeholder="URL du site" value={identityForm.website_url} onChange={e => setIdentityForm({ ...identityForm, website_url: e.target.value })} />
                   <input className="field-input" placeholder="Ville / localisation" value={identityForm.city} onChange={e => setIdentityForm({ ...identityForm, city: e.target.value })} />
                  <div className="row gap-2">
                    <button className="btn btn-primary" onClick={saveIdentity}>Enregistrer le contact</button>
                    <button className="btn btn-ghost" onClick={() => setEditingIdentity(false)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <button className="profile-add-context" style={{ marginTop: 12 }} onClick={() => { setEditingIdentity(true); setIdentityForm({ email: identity.email || "", phone: identity.phone || "", linkedin_url: identity.linkedin_url || "", github_url: identity.github_url || "", website_url: identity.website_url || "", city: identity.city || "" }); }}>
                  <Icon name="edit" size={14} /> Contact et liens
                </button>
              )}
              <div className="profile-rail-stats">
                <div>
                  <span>Preuves</span>
                  <strong>{evidenceCount}</strong>
                </div>
                <div>
                  <span>Stack</span>
                  <strong>{topStacks.length}</strong>
                </div>
              </div>
              {visibleStacks.length > 0 && (
                <div className="profile-stack-mini profile-rail-stack">
                  {visibleStacks.map(s => <span key={s} className="pill">{s}</span>)}
                </div>
              )}
              <button className="profile-primary-action" onClick={() => setView("ingestion")}>
                 <Icon name="plus" size={14} /> Ajouter du contexte
              </button>
            </>
          )}
            </div>
          </aside>

          <main className="profile-main-panel">
            <section className="card profile-overview-card">
              <div className="profile-overview-head">
                <div>
                  <span className="eyebrow">Aperçu du profil</span>
                  <h3>Données candidat structurées</h3>
                </div>
                <div className="row gap-2">
                  <button className="btn btn-ghost" onClick={() => setConfirmCleanupOpen(true)} disabled={cleaningProfile}>
                    {cleaningProfile ? <span className="spinner-sm profile-delete-spinner" aria-hidden="true" /> : <Icon name="spark" size={14} />}
                    {cleaningProfile ? "Nettoyage..." : "Nettoyer"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setView("ingestion")}>
                    <Icon name="plus" size={14} /> Ajouter du contexte
                  </button>
                </div>
              </div>
              {confirmCleanupOpen && (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 8, background: "var(--bad-soft)", border: "1px solid var(--bad)", color: "var(--ink-1)", fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Confirmer le nettoyage du profil ?</div>
                  <div style={{ color: "var(--ink-2)", lineHeight: 1.5 }}>
                    Cette action supprime les doublons, retire les lignes vides et normalise les champs malformés. Vérifiez le profil après nettoyage.
                  </div>
                  <div className="row gap-2" style={{ marginTop: 12 }}>
                    <button className="btn danger-soft" onClick={cleanupProfile} disabled={cleaningProfile}>
                      {cleaningProfile ? <span className="spinner-sm profile-delete-spinner" aria-hidden="true" /> : <Icon name="spark" size={14} />}
                      Confirmer le nettoyage
                    </button>
                    <button className="btn btn-ghost" onClick={() => setConfirmCleanupOpen(false)} disabled={cleaningProfile}>Annuler</button>
                  </div>
                </div>
              )}
              <div className="profile-overview-grid">
                {tabNodes.map(node => (
                  <button key={node.id} className={`profile-overview-stat profile-overview-stat-${node.tone} ${activeProfileTab === node.id ? "active" : ""}`} onClick={() => { setActiveProfileTab(node.id); setEditId(null); }}>
                    <Icon name={node.icon} size={16} />
                    <span>{node.label}</span>
                    <strong>{node.count}</strong>
                  </button>
                ))}
                <div className="profile-overview-stack">
                  <div>
                    <span className="eyebrow">Tags de stack</span>
                    <strong>{topStacks.length}</strong>
                  </div>
                  <div className="profile-stack-mini">
                    {visibleStacks.length ? visibleStacks.map(s => <span key={s} className="pill">{s}</span>) : <span className="pill">Aucune stack projet</span>}
                  </div>
                </div>
              </div>
            </section>

            <section className="card profile-tab-card">
              <div className="profile-tabs">
                {tabNodes.map(node => (
                  <button
                    key={node.id}
                    className={activeProfileTab === node.id ? "active" : ""}
                    onClick={() => { setActiveProfileTab(node.id); setEditId(null); }}
                  >
                    <Icon name={node.icon} size={14} />
                    <span>{node.label}</span>
                    <span className="mono">{node.count}</span>
                  </button>
                ))}
              </div>

              <div className="profile-tab-scroll">
                {activeProfileTab === "skills" && (
                  <div className="profile-skill-grid">
                    {skillItems.length === 0 && <div className="profile-empty">Aucune compétence enregistrée.</div>}
                    {previewSkills.map((s, idx) => {
                      const tone = ["blue", "yellow", "purple", "green", "orange", "teal"][idx % 6];
                      return (
                        <div key={`${s.id || s.label}-${idx}`} className={`profile-list-tile profile-list-tile-${tone}`}>
                          <div className="profile-list-leading">
                            <Icon name="check" size={14} />
                            <span>{s.label}</span>
                          </div>
                          <div className="profile-list-trailing">
                            <span className="profile-count-badge">{s.cat}</span>
                            {deleteStatus(`skill:${s.id || s.label}`)}
                            <button className="profile-row-action" onClick={() => deleteItem("skill", s.id || s.label)} disabled={isDeleting} title={deleteButtonTitle(`skill:${s.id || s.label}`, s.label)}>
                              {deleteButtonContent(`skill:${s.id || s.label}`)}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeProfileTab === "experience" && (
                  <div className="profile-timeline">
                    {exp.length === 0 && <div className="profile-empty">Aucune expérience enregistrée.</div>}
                    {previewExp.map((e: unknown, idx: number) => {
                      const item = asRecord(e);
                      const rowId = textValue(item.id);
                      const rowKey = profileDeleteKey(e) || `experience-${idx}`;
                      const role = textValue(item.role);
                      const company = textValue(item.co);
                      const period = textValue(item.period);
                      const description = textValue(item.d);
                      return (
                      <div key={rowKey} className="profile-timeline-item">
                        {rowId && editId === rowId ? (
                          <div className="col gap-3">
                            <div className="grid-2 gap-3">
                            <input className="field-input" value={editField("role")} placeholder="Poste" onChange={v => setEditField("role", v.target.value)} />
                              <input className="field-input" value={editField("co")} placeholder="Entreprise" onChange={v => setEditField("co", v.target.value)} />
                            </div>
                            <input className="field-input" value={editField("period")} placeholder="Période" onChange={v => setEditField("period", v.target.value)} />
                            <textarea className="field-input" value={editField("d")} rows={4} placeholder="Description" onChange={v => setEditField("d", v.target.value)} />
                            <div className="row gap-2">
                              <button className="btn btn-primary" onClick={() => saveEdit("experience", rowId)}>Enregistrer</button>
                              <button className="btn btn-ghost" onClick={() => setEditId(null)}>Annuler</button>
                            </div>
                          </div>
                        ) : (
                          <div className="col gap-1">
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                              <div className="col">
                                <div className="profile-card-title">{role}</div>
                                <div className="row gap-2" style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3 }}>
                                  <span>{company}</span><span style={{ color: "var(--ink-4)" }}>-</span><span className="mono" style={{ fontSize: 11 }}>{period}</span>
                                </div>
                              </div>
                              <div className="row gap-2">
                                <span className="profile-count-badge">{idx + 1}</span>
                                {deleteStatus(`experience:${rowKey}`)}
                                <button className="btn-icon profile-mini-action" onClick={() => { setEditId(rowId); setEditData({ ...item }); }} disabled={!rowId || isDeletingKey(`experience:${rowKey}`)} title={rowId ? "Modifier l'expérience" : "Réimportez ou rafraîchissez le graphe avant de modifier cette ligne"}><Icon name="edit" size={14} /></button>
                                <button className="btn-icon profile-mini-action profile-danger" onClick={() => deleteItem("experience", rowKey)} disabled={isDeleting} title={deleteButtonTitle(`experience:${rowKey}`, entryTitle(e) || "experience")} >{deleteButtonContent(`experience:${rowKey}`)}</button>
                              </div>
                            </div>
                            {description && <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6, marginTop: 10, whiteSpace: "pre-wrap" }}>{description}</div>}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}

                {activeProfileTab === "projects" && (
                  <div className="profile-project-grid">
                    {projects.length === 0 && <div className="profile-empty">Aucun projet mappé.</div>}
                    {previewProjects.map((p: unknown, idx: number) => {
                      const item = asRecord(p);
                      const rowId = textValue(item.id);
                      const rowKey = profileDeleteKey(p) || `project-${idx}`;
                      const title = textValue(item.title);
                      const impact = textValue(item.impact);
                      const repo = textValue(item.repo);
                      const projectStack = stackItems(item.stack);
                      return (
                      <div key={rowKey} className="profile-project-card">
                        {rowId && editId === rowId ? (
                          <div className="col gap-3">
                            <input className="field-input" value={editField("title")} placeholder="Titre" onChange={v => setEditField("title", v.target.value)} />
                            <input className="field-input" value={editField("stack")} placeholder="Stack (séparée par des virgules)" onChange={v => setEditField("stack", v.target.value)} />
                            <input className="field-input" value={editField("repo")} placeholder="URL du repo" onChange={v => setEditField("repo", v.target.value)} />
                            <textarea className="field-input" value={editField("impact")} rows={4} placeholder="Impact" onChange={v => setEditField("impact", v.target.value)} />
                            <div className="row gap-2">
                              <button className="btn btn-primary" onClick={() => saveEdit("project", rowId)}>Enregistrer</button>
                              <button className="btn btn-ghost" onClick={() => setEditId(null)}>Annuler</button>
                            </div>
                          </div>
                        ) : (
                          <div className="col gap-1">
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                              <div className="profile-card-title">{title}</div>
                              <div className="row gap-2">
                                <span className="profile-count-badge">{idx + 1}</span>
                                {deleteStatus(`project:${rowKey}`)}
                                <button className="btn-icon profile-mini-action" onClick={() => { setEditId(rowId); setEditData({ ...item, stack: projectStack.join(", ") }); }} disabled={!rowId || isDeletingKey(`project:${rowKey}`)} title={rowId ? "Modifier le projet" : "Réimportez ou rafraîchissez le graphe avant de modifier cette ligne"}><Icon name="edit" size={14} /></button>
                                <button className="btn-icon profile-mini-action profile-danger" onClick={() => deleteItem("project", rowKey)} disabled={isDeleting} title={deleteButtonTitle(`project:${rowKey}`, entryTitle(p) || "project")}>{deleteButtonContent(`project:${rowKey}`)}</button>
                              </div>
                            </div>
                            <div className="row gap-1" style={{ flexWrap: "wrap", margin: "8px 0 10px" }}>
                              {projectStack.map((s, i) => (
                                <span key={i} className="pill" style={{ fontSize: 11, padding: "4px 10px", background: "var(--pink-soft)", color: "var(--pink-ink)", border: "1px solid var(--pink)" }}>{s.trim()}</span>
                              ))}
                            </div>
                            {impact && <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>{impact}</div>}
                            {repo && <div className="row gap-2" style={{ marginTop: 10 }}><Icon name="link" size={12} color="var(--ink-3)" /><a href={repo} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--ink-3)" }}>{repo}</a></div>}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
                {activeProfileTab === "education" && (
                  <div className="profile-skill-grid">
                    {education.length === 0 && <div className="profile-empty">Aucune formation enregistrée.</div>}
                    {previewEducation.map((item: unknown, idx: number) => {
                      const rowKey = profileDeleteKey(item);
                      return (
                      <div key={`${entryTitle(item)}-${idx}`} className="profile-list-tile profile-list-tile-green">
                        <div className="profile-list-leading">
                          <Icon name="file" size={14} />
                          <span>{entryTitle(item)}</span>
                        </div>
                        <div className="profile-list-trailing">
                          <span className="profile-count-badge">{idx + 1}</span>
                          {deleteStatus(`education:${rowKey}`)}
                          <button className="profile-row-action" onClick={() => deleteItem("education", rowKey)} disabled={isDeleting} title={deleteButtonTitle(`education:${rowKey}`, entryTitle(item) || "education")}>
                            {deleteButtonContent(`education:${rowKey}`)}
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
                {activeProfileTab === "certifications" && (
                  <div className="profile-skill-grid">
                    {certifications.length === 0 && <div className="profile-empty">Aucune certification enregistrée.</div>}
                    {previewCertifications.map((item: unknown, idx: number) => {
                      const rowKey = profileDeleteKey(item);
                      return (
                      <div key={`${entryTitle(item)}-${idx}`} className="profile-list-tile profile-list-tile-purple">
                        <div className="profile-list-leading">
                          <Icon name="check" size={14} />
                          <span>{entryTitle(item)}</span>
                        </div>
                        <div className="profile-list-trailing">
                          <span className="profile-count-badge">{idx + 1}</span>
                          {deleteStatus(`certification:${rowKey}`)}
                          <button className="profile-row-action" onClick={() => deleteItem("certification", rowKey)} disabled={isDeleting} title={deleteButtonTitle(`certification:${rowKey}`, entryTitle(item) || "certification")}>
                            {deleteButtonContent(`certification:${rowKey}`)}
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
                {activeProfileTab === "achievements" && (
                  <div className="profile-skill-grid">
                    {achievements.length === 0 && <div className="profile-empty">Aucune réussite enregistrée.</div>}
                    {previewAchievements.map((item: unknown, idx: number) => {
                      const rowKey = profileDeleteKey(item);
                      return (
                      <div key={`${entryTitle(item)}-${idx}`} className="profile-list-tile profile-list-tile-yellow">
                        <div className="profile-list-leading">
                          <Icon name="trending" size={14} />
                          <span>{entryTitle(item)}</span>
                        </div>
                        <div className="profile-list-trailing">
                          <span className="profile-count-badge">{idx + 1}</span>
                          {deleteStatus(`achievement:${rowKey}`)}
                          <button className="profile-row-action" onClick={() => deleteItem("achievement", rowKey)} disabled={isDeleting} title={deleteButtonTitle(`achievement:${rowKey}`, entryTitle(item) || "achievement")}>
                            {deleteButtonContent(`achievement:${rowKey}`)}
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
                {listTotal > listShown && (
                  <button className="profile-view-all" onClick={() => setExpandedProfileList(true)}>
                    Voir les {listTotal} éléments <Icon name="arrow-right" size={13} />
                  </button>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
