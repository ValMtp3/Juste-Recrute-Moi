// Topbar — page title + breadcrumb + actions
const Topbar = ({ view, leadCounts, ghost, setGhost }) => {
  const meta = (NAV.find(n => n.id === view)) || NAV[0];
  const subtitles = {
    dashboard: "Snapshot of every signal across the agent stack.",
    pipeline:  "Evaluate, tailor, approve. The hunt in motion.",
    graph:     "Local Kùzu knowledge graph — your portable brain.",
    activity:  "Real-time agent thoughts and system events.",
    profile:   "Teach the agent who you are. Drop a resume.",
  };
  return (
    <header className="topbar">
      <div className="col gap-1" style={{ flex: 1 }}>
        <div className="row gap-2 mono" style={{ fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
          <span>Juste Recrute Moi</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: `var(--${meta.tone}-ink)` }}>{meta.label}</span>
        </div>
        <h2 style={{ fontSize: 28 }}>{meta.label} <span className="italic-serif" style={{ color: "var(--ink-3)" }}>· {subtitles[view]?.split(".")[0].toLowerCase()}</span></h2>
      </div>

      <div className="row gap-2">
        <div className="row gap-2" style={{
          padding: "6px 12px", borderRadius: 999,
          background: ghost ? "var(--purple)" : "var(--paper-2)",
          border: "1px solid " + (ghost ? "var(--purple-ink)" : "var(--line)"),
          color: ghost ? "var(--purple-ink)" : "var(--ink-2)",
          fontSize: 12, fontWeight: 500,
        }}>
          <Icon name="ghost" size={13}/>
          <span>{ghost ? "Ghost Mode" : "Human-in-loop"}</span>
          <button onClick={() => setGhost(!ghost)} style={{
            background: "transparent", border: "none", padding: 0,
            color: "inherit", cursor: "pointer", fontWeight: 600, marginLeft: 4,
            textDecoration: "underline", textUnderlineOffset: 2,
          }}>switch</button>
        </div>
        <button className="btn"><Icon name="search" size={14}/> Search</button>
        <button className="btn btn-accent"><Icon name="plus" size={14}/> Add board</button>
      </div>
    </header>
  );
};

window.Topbar = Topbar;
