import type { GraphStats } from "../../types";
import { GraphCanvas } from "./GraphCanvas";
import { EmbeddingAtlas } from "./EmbeddingAtlas";

export function GraphView({ stats }: { stats: GraphStats }) {
  const hasGraphPayload = Array.isArray(stats.graph?.nodes);
  // A version-skewed sidecar can return `graph` without `nodes`/`edges` —
  // chain all the way down or this header crashes before the fallback renders.
  const total = stats.graph?.nodes?.length ?? 0;
  const relationCount = stats.graph?.edges?.length ?? 0;
  const isLoading = Boolean(stats.loading && !stats.loaded);
  const requestError = stats.request_error || "";
  const isLive = stats.status === "live" && stats.available !== false && hasGraphPayload && !requestError;
  const syncedAt = stats.sync?.refreshed_at
    ? new Date(stats.sync.refreshed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="scroll graph-page">
      <div className="graph-shell graph-shell-single">
        <div className="card graph-overview graph-overview-sleek">
          <div className="graph-overview-copy">
            <span className="eyebrow">Graphe de connaissances</span>
            <h1 style={{ fontSize: 30 }}>Your profile, connected</h1>
            <p>Every project, skill, role, and credential and how they relate. Click a node to focus it; scroll to zoom, drag to move.</p>
          </div>
          <div className="graph-overview-stats">
            <div>
              <span className="eyebrow">Total nodes</span>
              <div className="display tabular graph-total">{total}</div>
            </div>
            <div className="graph-mini-stats">
              <div><span>{relationCount}</span><small>Connections</small></div>
            </div>
            <span
              className="pill mono"
              title={!hasGraphPayload ? "Backend response is missing graph nodes and edges" : (stats.error || (syncedAt ? `Synced at ${syncedAt}` : "Graph status"))}
              style={{
                justifySelf: "end",
                background: isLive ? "var(--green-soft)" : "var(--bad-soft)",
                color: isLive ? "var(--green-ink)" : "var(--bad)",
                border: `1px solid ${isLive ? "var(--green)" : "var(--bad)"}`,
              }}
            >
              {isLive ? "actif" : isLoading ? "chargement" : requestError ? "requête échouée" : hasGraphPayload ? "dégradé" : "graphe absent"}
            </span>
          </div>
        </div>

        {!isLive && !isLoading && (
          <div className="card" style={{ color: "var(--bad)", background: "var(--bad-soft)", borderColor: "var(--bad)", padding: 14 }}>
            {requestError
              ? requestError
              : !hasGraphPayload
                ? "Le endpoint graphe a répondu sans nœuds ni liens. Ouvrez Activité pour voir l'erreur backend, ou redémarrez l'app Tauri dev si le backend a changé pendant l'exécution."
              : stats.error?.toLowerCase().includes("locked by another juste recrute moi")
                ? stats.error
                : `Le stockage graphe est indisponible : ${stats.error || "erreur inconnue"}`}
          </div>
        )}

        {isLoading && !hasGraphPayload ? (
          <div className="card kg-card"><div className="kg-laying" style={{ position: "static", padding: 48 }}>Chargement du graphe de connaissances...</div></div>
        ) : (
          <GraphCanvas nodes={stats.graph?.nodes || []} edges={stats.graph?.edges || []} />
        )}

        {isLive && <EmbeddingAtlas stats={stats} />}
      </div>
    </div>
  );
}
