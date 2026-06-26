import { useEffect, useMemo, useState } from "react";
import Icon from "../../shared/components/Icon";
import { LeadFilterBar } from "./components/LeadFilterBar";
import { PipelineJobCard, PipelineSkeleton } from "./components/JobCard";
import type { ApiFetch, Lead, LeadSort, OperationProgress, PipelineTab, SeniorityFilter, View } from "../../types";
import { PAGE_SIZE, leadSearchText, sortLeads, seniorityMatches, uniqueLeadValues } from "../../shared/lib/leadUtils";
import { emitAppEvent } from "../../shared/lib/appEvents";

export function PipelineView({ leads, openDrawer, deleteLead, port, api, scanning, reevaluating, cleaning, progress, onScan, scanSpeed, setScanSpeed, onReevaluate, onStopReevaluate, onCleanup, setView, loading, error, tab }: {
  leads: Lead[]; openDrawer: (l: Lead) => void;
  deleteLead: (id: string) => void; port: number | null; api: ApiFetch | null;
  scanning: boolean; reevaluating: boolean; cleaning: boolean;
  progress: OperationProgress;
  onScan: (speed?: "rapide" | "moyen" | "max") => void;
  scanSpeed?: "rapide" | "moyen" | "max";
  setScanSpeed?: (speed: "rapide" | "moyen" | "max") => void;
  onReevaluate: () => void; onStopReevaluate: () => void; onCleanup: () => void; setView: (view: View) => void;
  loading: boolean; error: string | null;
  tab: PipelineTab;
}) {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState<LeadSort>("recommended");
  const [seniority, setSeniority] = useState<SeniorityFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [bulkSelecting, setBulkSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"delete" | "applied" | null>(null);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<{ tone: "success" | "warning" | "error"; message: string } | null>(null);

  useEffect(() => setVisibleCount(PAGE_SIZE), [tab, search, platform, sort, seniority]);
  useEffect(() => {
    setBulkSelecting(false);
    setSelected(new Set());
    setBulkConfirmDelete(false);
    setBulkNotice(null);
  }, [tab]);

  const platforms = useMemo(() => uniqueLeadValues(leads, "platform"), [leads]);

  const tabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const keep = (lead: Lead) => {
      if (q && !leadSearchText(lead).includes(q)) return false;
      if (platform && lead.platform !== platform) return false;
      if (!seniorityMatches(lead, seniority)) return false;
      return true;
    };
    const apply = (arr: Lead[]) => sortLeads(arr.filter(keep), sort);
    const tabItems: { id: PipelineTab; label: string; tone: string; leads: Lead[] }[] = [
      { id: "all",       label: "Toutes",       tone: "teal",   leads: apply(leads) },
      { id: "hot",       label: "Prioritaires", tone: "orange", leads: apply(leads.filter(l => (l.signal_score || 0) >= 80 || (l.score || 0) >= 85)) },
      { id: "found",     label: "Nouvelles",    tone: "blue",   leads: apply(leads.filter(l => l.status === "discovered")) },
      { id: "evaluated", label: "Notées",       tone: "yellow", leads: apply(leads.filter(l => l.score > 0 || (l.signal_score || 0) > 0)) },
      { id: "generated", label: "Prêtes",       tone: "purple", leads: apply(leads.filter(l => l.status === "tailoring" || l.status === "approved")) },
      { id: "applied",   label: "Postulées",    tone: "orange", leads: apply(leads.filter(l => l.status === "applied")) },
      { id: "discarded", label: "Masquées",     tone: "bad",    leads: apply(leads.filter(l => l.status === "discarded")) },
    ];
    return tabItems;
  }, [leads, search, platform, sort, seniority]);

  const activeTab = tabs.find(t => t.id === tab) || tabs[0];
  const visibleLeads = activeTab.leads.slice(0, visibleCount);
  const hasFilters = Boolean(search || platform || seniority !== "all" || sort !== "recommended");
  const busyLabel = scanning ? "Recherche de nouvelles offres" : reevaluating ? "Réévaluation des scores" : cleaning ? "Nettoyage des mauvaises données" : "";

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkNotice(null);
    setBulkConfirmDelete(false);
  };

  const bulkDelete = async () => {
    if (selected.size === 0 || bulkBusy) return;
    if (!bulkConfirmDelete) {
      setBulkConfirmDelete(true);
      setBulkNotice({ tone: "warning", message: `Confirmez la suppression définitive de ${selected.size} offre${selected.size > 1 ? "s" : ""}.` });
      return;
    }
    const count = selected.size;
    setBulkBusy("delete");
    setBulkNotice({ tone: "warning", message: `Suppression de ${count} offre${count > 1 ? "s" : ""} en cours...` });
    try {
      const results = await Promise.allSettled([...selected].map(id => Promise.resolve(deleteLead(id))));
      const failed = results.filter(r => r.status === "rejected").length;
      const done = count - failed;
      setBulkNotice(failed > 0
        ? { tone: "error", message: `${failed} suppression${failed > 1 ? "s" : ""} sur ${count} ont échoué. La liste va être rafraîchie.` }
        : { tone: "success", message: `${done} offre${done > 1 ? "s" : ""} supprimée${done > 1 ? "s" : ""}.` });
      setSelected(new Set());
      setBulkSelecting(false);
      setBulkConfirmDelete(false);
      emitAppEvent("leads-refresh");
    } finally {
      setBulkBusy(null);
    }
  };

  const bulkMarkApplied = async () => {
    if (!api || selected.size === 0 || bulkBusy) return;
    const ids = [...selected];
    setBulkBusy("applied");
    setBulkNotice({ tone: "warning", message: `Marquage de ${ids.length} offre${ids.length > 1 ? "s" : ""} en postulée${ids.length > 1 ? "s" : ""}...` });
    try {
      const results = await Promise.allSettled(ids.map(id => api(`/api/v1/leads/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "applied" }),
      })));
      const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)).length;
      const succeeded = ids.length - failed;
      if (failed > 0) {
        setBulkNotice({ tone: "error", message: `${failed} offre${failed > 1 ? "s" : ""} sur ${ids.length} n'ont pas pu être marquées comme postulées.` });
      } else {
        setBulkNotice({ tone: "success", message: `${succeeded} offre${succeeded > 1 ? "s" : ""} marquée${succeeded > 1 ? "s" : ""} comme postulée${succeeded > 1 ? "s" : ""}.` });
      }
      ids.forEach(job_id => emitAppEvent("lead-updated", { job_id, status: "applied" }));
      setSelected(new Set());
      setBulkSelecting(false);
      setBulkConfirmDelete(false);
      emitAppEvent("leads-refresh");
    } finally {
      setBulkBusy(null);
    }
  };

  const exportCsv = async () => {
    if (!api || exporting) return;
    setExporting(true);
    setExportErr(null);
    try {
      const res = await api("/api/v1/leads/export.csv");
      if (!res.ok) throw new Error(`Export échoué (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jhm_pipeline.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : "Export échoué");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="pipeline-page">
      <div className="pipeline-top">
        {(busyLabel || error || exportErr || bulkNotice) && (
          <div className={`pipeline-notice ${error || exportErr ? "error" : bulkNotice?.tone || ""}`}>
            {error || exportErr || bulkNotice?.tone === "error" ? <Icon name="x" size={13} /> : bulkNotice?.tone === "success" ? <Icon name="check" size={13} /> : <span className="dot pulse-soft" />}
            <span>{error || exportErr || bulkNotice?.message || busyLabel}</span>
          </div>
        )}
        {scanning && progress.active && progress.total > 0 && (
          <div style={{ marginTop: 12, marginBottom: 12, maxWidth: 560 }}>
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

        <LeadFilterBar
          search={search}
          setSearch={setSearch}
          platform={platform}
          setPlatform={setPlatform}
          sort={sort}
          setSort={setSort}
          seniority={seniority}
          setSeniority={setSeniority}
          platforms={platforms}
          total={activeTab.leads.length}
          shown={Math.min(visibleCount, activeTab.leads.length)}
          label="les offres"
          actions={(
            <>
              <button className="btn" onClick={exportCsv} disabled={!api || exporting || loading}>
                {exporting ? "Export..." : "Exporter"}
              </button>
              {bulkSelecting ? (
                <>
                  <button className="btn" onClick={bulkMarkApplied} disabled={!api || selected.size === 0 || loading || Boolean(bulkBusy)}>
                    <Icon name="check" size={13} /> {bulkBusy === "applied" ? "Marquage..." : `Marquer postulées ${selected.size}`}
                  </button>
                  <button className="btn" onClick={() => { setBulkSelecting(false); setSelected(new Set()); setBulkConfirmDelete(false); setBulkNotice(null); }} disabled={Boolean(bulkBusy)}>Annuler</button>
                </>
              ) : (
                <button className="btn" onClick={() => { setBulkSelecting(true); setBulkNotice(null); }} disabled={activeTab.leads.length === 0 || loading || Boolean(bulkBusy)}>
                  <Icon name="check" size={13} /> Sélectionner
                </button>
              )}
              {reevaluating ? (
                <button className="btn danger" onClick={onStopReevaluate}>
                  <Icon name="x" size={13} /> Stop re-score
                </button>
              ) : (
                <button className="btn" onClick={onReevaluate} disabled={leads.length === 0 || scanning || cleaning || loading}>
                  <Icon name="pulse" size={13} /> Re-scorer
                </button>
              )}
              <button className="btn danger-soft" onClick={onCleanup} disabled={leads.length === 0 || scanning || reevaluating || cleaning || loading}>
                <Icon name="trash" size={13} /> {cleaning ? "Nettoyage" : "Nettoyer"}
              </button>
              {tab === "discarded" && (
                bulkSelecting ? (
                  <button className="btn danger" onClick={bulkDelete} disabled={selected.size === 0 || Boolean(bulkBusy)}>
                    {bulkBusy === "delete" ? "Suppression..." : bulkConfirmDelete ? `Confirmer ${selected.size}` : `Supprimer ${selected.size}`}
                  </button>
                ) : (
                  <button className="btn" onClick={() => setBulkSelecting(true)} disabled={activeTab.leads.length === 0}>Suppression groupée</button>
                )
              )}
            </>
          )}
        />
      </div>

      <div className="pipeline-content scroll">
        <div className="pipeline-results-head">
          <div>
            <h3>{activeTab.label}</h3>
            <p>{hasFilters ? "Résultats filtrés" : "Toutes les offres correspondantes"} - {Math.min(visibleCount, activeTab.leads.length)} sur {activeTab.leads.length}</p>
          </div>
          {bulkSelecting && (
            <span className={`pipeline-selected mono ${tab === "discarded" ? "danger" : "applied"}`}>
              {selected.size} sélectionnées
            </span>
          )}
        </div>
        {loading ? (
          <PipelineSkeleton />
        ) : activeTab.leads.length === 0 ? (
          <div className="pipeline-empty">
            <Icon name={hasFilters ? "filter" : "search"} size={18} />
             <h3>{hasFilters ? "Aucune offre ne correspond à ces filtres" : `Aucune offre ${activeTab.label.toLowerCase()} pour l'instant`}</h3>
             <p>{hasFilters ? "Effacez les filtres ou baissez les seuils de score." : "Lancez un scan depuis l'accueil ou collez une offre à adapter pour remplir cette colonne."}</p>
             <div className="pipeline-empty-actions">
               {hasFilters ? (
                 <button className="btn" onClick={() => {
                   setSearch("");
                   setPlatform("");
                   setSeniority("all");
                   setSort("recommended");
                 }}>
                   Effacer les filtres
                 </button>
               ) : (
                 <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
                      <button className="btn btn-accent" onClick={() => onScan(scanSpeed)} disabled={scanning || reevaluating || cleaning || loading}>
                        <Icon name="search" size={13} color="#fff" /> Scanner maintenant
                      </button>
                      {setScanSpeed && (
                        <select
                          value={scanSpeed || "moyen"}
                          onChange={e => setScanSpeed(e.target.value as "rapide" | "moyen" | "max")}
                          disabled={scanning || reevaluating || cleaning || loading}
                          style={{
                            height: 32,
                            padding: "0 8px",
                            borderRadius: 6,
                            border: "1px solid var(--line)",
                            background: "var(--paper)",
                            fontSize: 12,
                            color: "var(--ink)",
                            cursor: scanning || reevaluating || cleaning ? "not-allowed" : "pointer",
                          }}
                        >
                          <option value="rapide">Rapide (±5)</option>
                          <option value="moyen">Moyen (±20)</option>
                          <option value="max">Max (toutes)</option>
                        </select>
                      )}
                    </div>
                    {!scanning && scanSpeed === "max" && (
                      <div style={{
                        fontSize: 11,
                        color: "var(--bad)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        fontWeight: 500,
                      }}>
                        <Icon name="alert-circle" size={12} color="var(--bad)" />
                        <span>Attention : le mode Max (150 offres/source) augmente le risque de bannissement par les API.</span>
                      </div>
                    )}
                  </div>
                  <button className="btn" onClick={() => setView("apply")}>
                     <Icon name="spark" size={13} /> Adapter une offre
                   </button>
                 </>
               )}
             </div>
          </div>
        ) : (
          <div className="pipeline-list">
            {visibleLeads.map(lead => (
              <div key={lead.job_id} className="pipeline-list-item">
                {bulkSelecting && (
                  <div
                    className="pipeline-select-box"
                    onClick={() => toggleSelect(lead.job_id)}
                    style={{
                      borderColor: selected.has(lead.job_id) ? (tab === "discarded" ? "var(--bad)" : "var(--orange)") : "var(--line)",
                      background: selected.has(lead.job_id) ? (tab === "discarded" ? "var(--bad)" : "var(--orange)") : "var(--paper)",
                    }}
                  >
                    {selected.has(lead.job_id) && <Icon name="check" size={11} color="#fff" />}
                  </div>
                )}
                <PipelineJobCard
                  lead={lead}
                  onOpen={openDrawer}
                  onDelete={deleteLead}
                  showGenerate={tab === "evaluated"}
                  port={port}
                  api={api}
                />
              </div>
            ))}
          </div>
        )}
        {activeTab.leads.length > visibleCount && (
          <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
            <button className="btn" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>
              Afficher les {Math.min(PAGE_SIZE, activeTab.leads.length - visibleCount)} suivantes sur {activeTab.leads.length}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PENTAGON GRAPH COMPONENT
══════════════════════════════════════ */
