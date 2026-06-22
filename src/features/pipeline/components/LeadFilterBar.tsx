import type { ReactNode } from "react";
import Icon from "../../../shared/components/Icon";
import type { LeadSort, SeniorityFilter } from "../../../types";

export function LeadFilterBar({
  search, setSearch, platform, setPlatform, sort, setSort,
  seniority, setSeniority, platforms, total, shown, label, actions,
}: {
  search: string; setSearch: (v: string) => void;
  platform: string; setPlatform: (v: string) => void;
  sort: LeadSort; setSort: (v: LeadSort) => void;
  seniority: SeniorityFilter; setSeniority: (v: SeniorityFilter) => void;
  platforms: string[]; total: number; shown: number; label: string;
  actions?: ReactNode;
}) {
  const hasFilters = Boolean(search || platform || seniority !== "all" || sort !== "recommended");
  const resetFilters = () => {
    setSearch("");
    setPlatform("");
    setSeniority("all");
    setSort("recommended");
  };

  return (
    <div className="pipeline-filterbar">
      <label className="pipeline-searchbox">
        <Icon name="search" size={14} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Rechercher ${label}`}
        />
      </label>

      <div className="pipeline-filter-fields">
        <label className="pipeline-field">
          <span>Source</span>
          <select value={platform} onChange={e => setPlatform(e.target.value)}>
            <option value="">Toutes les sources</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="pipeline-field">
          <span>Niveau</span>
          <select value={seniority} onChange={e => setSeniority(e.target.value as SeniorityFilter)}>
            <option value="all">Tous niveaux</option>
            <option value="beginner">Débutant</option>
            <option value="fresher">Stage / alternance</option>
            <option value="junior">Junior</option>
            <option value="mid">Intermédiaire</option>
            <option value="senior">Senior</option>
            <option value="unknown">Inconnu</option>
          </select>
        </label>
        <label className="pipeline-field">
          <span>Tri</span>
          <select value={sort} onChange={e => setSort(e.target.value as LeadSort)}>
            <option value="recommended">Recommandé</option>
            <option value="newest">Plus récent</option>
            <option value="signal">Meilleur signal</option>
            <option value="match">Meilleur match</option>
            <option value="company">Entreprise</option>
          </select>
        </label>
      </div>

      <div className="pipeline-filter-actions">
        <span className="pipeline-count mono">{shown}/{total}</span>
        {hasFilters && <button className="pipeline-clear" onClick={resetFilters}>Effacer</button>}
      </div>
      {actions && <div className="pipeline-actions">{actions}</div>}
    </div>
  );
}
