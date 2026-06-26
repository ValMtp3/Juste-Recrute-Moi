import { useCallback, useEffect, useRef, useState } from "react";
import { SectionLabel } from "./shared";
import type { ApiFetch } from "../../../types";

export interface ResumeTemplate {
  id: string;
  name: string;
  source_filename: string;
  is_default: boolean;
  created_at: string;
  char_count: number;
  preview: string;
}

export function ResumeTemplatesPanel({ api }: { api: ApiFetch }) {
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string>("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api("/api/v1/templates");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "Les modèles n'ont pas pu être chargés");
      setTemplates(body.templates || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Les modèles n'ont pas pu être chargés");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx") && !lower.endsWith(".txt") && !lower.endsWith(".md")) {
      setError("Format non supporté. Importez un modèle en PDF, DOCX, TXT ou Markdown.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const willBecomeDefault = templates.length === 0;
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("make_default", templates.length === 0 ? "true" : "false");
      const res = await api("/api/v1/templates/upload", { method: "POST", body: form, timeoutMs: 60000 });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || `Import échoué (${res.status})`);
      await load();
      setMessage(willBecomeDefault ? "Modèle importé et défini comme style par défaut." : "Modèle importé.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'import a échoué");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const act = async (id: string, run: () => Promise<Response>, successMessage: string) => {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await run();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Action échouée (${res.status})`);
      }
      await load();
      setMessage(successMessage);
      setConfirmDeleteId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action échouée");
    } finally {
      setBusyId("");
    }
  };

  const setDefault = (id: string) => act(id, () => api(`/api/v1/templates/${id}/default`, { method: "POST" }), "Modèle défini comme style par défaut.");
  const remove = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setMessage("Cliquez sur Confirmer pour supprimer ce modèle.");
      return;
    }
    void act(id, () => api(`/api/v1/templates/${id}`, { method: "DELETE" }), "Modèle supprimé.");
  };

  return (
    <div>
      <SectionLabel label="Modèles de CV" sub="importez vos propres CV (PDF/DOCX) comme guides de style réutilisables — le générateur imite celui choisi pour chaque offre" />

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <button className="btn btn-accent" disabled={loading} onClick={() => fileRef.current?.click()} style={{ padding: "8px 18px", fontSize: 13, borderRadius: 10 }}>
          {loading ? "Traitement..." : "Importer un modèle de CV"}
        </button>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{templates.length} modèle{templates.length > 1 ? "s" : ""} enregistré{templates.length > 1 ? "s" : ""}</span>
      </div>

      {message && <div role="status" style={{ color: "var(--green-ink)", background: "var(--green-soft)", border: "1px solid var(--green)", borderRadius: 9, padding: "8px 10px", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{message}</div>}
      {error && <div role="alert" style={{ color: "var(--bad)", background: "var(--bad-soft)", border: "1px solid var(--bad)", borderRadius: 9, padding: "8px 10px", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{error}</div>}

      {loading && templates.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--paper-2)" }}>
          Chargement des modèles de CV...
        </div>
      )}

      {templates.length === 0 && !loading && (
        <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "12px 14px", border: "1px dashed var(--line)", borderRadius: 12 }}>
          Aucun modèle pour l'instant. Importez un CV dont vous aimez la structure : il deviendra le style par défaut des CV générés.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {templates.map(t => (
          <div key={t.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", background: t.is_default ? "var(--blue-soft)" : "var(--paper)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  {t.name}
                  {t.is_default && <span className="pill" style={{ fontSize: 10 }}>Défaut</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                  {t.source_filename || "texte collé"} · {t.char_count.toLocaleString()} caractères
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {!t.is_default && (
                  <button className="btn" disabled={busyId === t.id} onClick={() => setDefault(t.id)} style={{ padding: "6px 12px", fontSize: 12, borderRadius: 8 }}>
                    Définir par défaut
                  </button>
                )}
                <button className="btn" disabled={busyId === t.id} onClick={() => remove(t.id)} style={{ padding: "6px 12px", fontSize: 12, borderRadius: 8, color: "var(--bad)" }}>
                  {busyId === t.id ? "..." : confirmDeleteId === t.id ? "Confirmer" : "Supprimer"}
                </button>
                {confirmDeleteId === t.id && (
                  <button className="btn btn-ghost" disabled={busyId === t.id} onClick={() => { setConfirmDeleteId(""); setMessage(null); }} style={{ padding: "6px 12px", fontSize: 12, borderRadius: 8 }}>
                    Annuler
                  </button>
                )}
              </div>
            </div>
            {t.preview && (
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8, whiteSpace: "pre-wrap", maxHeight: 48, overflow: "hidden" }}>
                {t.preview}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
