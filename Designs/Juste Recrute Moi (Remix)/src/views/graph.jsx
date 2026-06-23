// Knowledge graph — full page
const GraphView = () => {
  const total = GRAPH_STATS.reduce((s, x) => s + x.count, 0);
  return (
    <div className="scroll" style={{ padding: 24, flex: 1 }}>
      <div className="card" style={{ padding: "26px 28px", marginBottom: 18, background: "var(--green-soft)" }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div className="col gap-2" style={{ maxWidth: 540 }}>
            <span className="eyebrow">Local kùzu graph</span>
            <h1 style={{ fontSize: 44 }}>Your portable <span className="italic-serif">knowledge brain</span></h1>
            <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
              Every skill, project, and lead is a node. Edges are inferred by GraphRAG. The agent uses this graph to score each opening before it tailors your résumé.
            </div>
          </div>
          <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
            <span className="eyebrow">Total nodes</span>
            <span className="display tabular" style={{ fontSize: 56, color: "var(--green-ink)", lineHeight: 1 }}>{total}</span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>+ 3,891 edges</span>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card" style={{ padding: 24, background: "var(--card)" }}>
          <h3 style={{ marginBottom: 4 }}>Topology</h3>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>5-vertex schema</div>
          <PentagonGraph stats={GRAPH_STATS}/>
        </div>
        <div className="col gap-2">
          {GRAPH_STATS.map(s => (
            <div key={s.key} style={{
              padding: 18, borderRadius: 14,
              background: `var(--${s.tone}-soft)`,
              border: `1px solid var(--${s.tone})`,
            }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="col gap-1">
                  <span className="eyebrow" style={{ color: `var(--${s.tone}-ink)` }}>{s.key}</span>
                  <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                    {{
                      Candidate:  "You — the root node",
                      Experience: "Roles & companies",
                      Project:    "Things you've built",
                      Skill:      "Capabilities & tooling",
                      JobLead:    "Discovered openings",
                    }[s.key]}
                  </div>
                </div>
                <div className="display tabular" style={{ fontSize: 36, color: `var(--${s.tone}-ink)` }}>{s.count}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 20, background: "var(--purple-soft)" }}>
        <h3>Recent graph mutations</h3>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, marginTop: 3 }}>last 24h</div>
        <div className="col gap-2">
          {[
            { op: "INSERT", node: "Skill",   detail: "Rust", tone: "green" },
            { op: "UPDATE", node: "JobLead", detail: "lead-1042 · status → tailoring", tone: "yellow" },
            { op: "INSERT", node: "Project", detail: "GraphRAG inference engine", tone: "green" },
            { op: "DELETE", node: "JobLead", detail: "lead-997 · expired posting", tone: "pink" },
            { op: "INSERT", node: "Skill",   detail: "Kùzu", tone: "green" },
          ].map((r, i) => (
            <div key={i} className="row gap-3" style={{
              padding: 10, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10,
            }}>
              <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: `var(--${r.tone})`, color: `var(--${r.tone}-ink)`, letterSpacing: "0.08em", textTransform: "uppercase" }}>{r.op}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", minWidth: 70 }}>{r.node}</span>
              <span style={{ fontSize: 13, flex: 1 }}>{r.detail}</span>
              <span className="mono tabular" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{[2, 14, 47, 63, 91][i]}m ago</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
window.GraphView = GraphView;
