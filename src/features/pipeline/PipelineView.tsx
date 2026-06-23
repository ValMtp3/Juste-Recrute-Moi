import { useEffect, useMemo, useState } from "react";
import Icon from "../../shared/components/Icon";
import { LeadFilterBar } from "./components/LeadFilterBar";
import { PipelineJobCard, PipelineSkeleton } from "./components/JobCard";
import type { ApiFetch, Lead, LeadSort, PipelineTab, SeniorityFilter } from "../../types";
import { PAGE_SIZE, leadSearchText, sortLeads, seniorityMatches, uniqueLeadValues } from "../../shared/lib/leadUtils";
import { emitAppEvent } from "../../shared/lib/appEvents";

export function PipelineView({ leads, openDrawer, deleteLead, port, api, scanning, reevaluating, cleaning, onReevaluate, onStopReevaluate, onCleanup, loading, error, tab }: {
  leads: Lead[]; openDrawer: (l: Lead) => void;
  deleteLead: (id: string) => void; port: number | null; api: ApiFetch | null;
  scanning: boolean; reevaluating: boolean; cleaning: boolean; onReevaluate: () => void; onStopReevaluate: () => void; onCleanup: () => void;
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

  useEffect(() => setVisibleCount(PAGE_SIZE), [tab, search, platform, sort, seniority]);
  useEffect(() => {
    setBulkSelecting(false);
    setSelected(new Set());
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
  };

  const bulkDelete = async () => {
    if (!window.confirm(`Supprimer ${selected.size} offres ?`)) return;
    const count = selected.size;
    const results = await Promise.allSettled([...selected].map(id => Promise.resolve(deleteLead(id))));
    const failed = results.filter(r => r.status === "rejected").length;
    if (failed > 0) alert(`${failed} suppressions sur ${count} ont échoué. Rafraîchissement de la liste.`);
    setSelected(new Set());
    setBulkSelecting(false);
    emitAppEvent("leads-refresh");
  };

  const bulkMarkApplied = async () => {
    if (!api || selected.size === 0) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map(id => api(`/api/v1/leads/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "applied" }),
    })));
    const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)).length;
    if (failed > 0) alert(`${failed} offres sur ${ids.length} n'ont pas pu être marquées comme postulées.`);
    ids.forEach(job_id => emitAppEvent("lead-updated", { job_id, status: "applied" }));
    setSelected(new Set());
    setBulkSelecting(false);
    emitAppEvent("leads-refresh");
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
        {(busyLabel || error || exportErr) && (
          <div className={`pipeline-notice ${error || exportErr ? "error" : ""}`}>
            {error || exportErr ? <Icon name="x" size={13} /> : <span className="dot pulse-soft" />}
            <span>{error || exportErr || busyLabel}</span>
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
                  <button className="btn" onClick={bulkMarkApplied} disabled={!api || selected.size === 0 || loading}>
                    <Icon name="check" size={13} /> Marquer postulées {selected.size}
                  </button>
                  <button className="btn" onClick={() => { setBulkSelecting(false); setSelected(new Set()); }}>Annuler</button>
                </>
              ) : (
                <button className="btn" onClick={() => setBulkSelecting(true)} disabled={activeTab.leads.length === 0 || loading}>
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
                  <button className="btn danger" onClick={bulkDelete} disabled={selected.size === 0}>Supprimer {selected.size}</button>
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
             <p>{hasFilters ? "Efface les filtres ou baisse les seuils de score." : "Lance un scan depuis l'accueil ou colle une offre à adapter pour remplir cette colonne."}</p>
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
