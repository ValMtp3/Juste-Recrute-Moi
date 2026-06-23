// Sidebar — proper nav with sections + counts
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "home",   tone: "blue"   },
  { id: "pipeline",  label: "Pipeline",  icon: "layers", tone: "purple" },
  { id: "graph",     label: "Knowledge", icon: "graph",  tone: "green"  },
  { id: "activity",  label: "Activity",  icon: "pulse",  tone: "orange" },
  { id: "profile",   label: "Profile",   icon: "user",   tone: "pink"   },
];

const Sidebar = ({ view, setView, leadCounts, online, latency, uptime, onSettings }) => {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="row gap-3" style={{ padding: "4px 8px 18px 8px" }}>
        <Icon name="logo" size={32}/>
        <div className="col" style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>Juste Recrute Moi</div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>v0.4.2</div>
        </div>
      </div>

      {/* Section: Workspace */}
      <div className="eyebrow" style={{ padding: "0 12px", marginBottom: 4 }}>Workspace</div>
      <div className="col gap-1">
        {NAV.map(n => {
          const active = view === n.id;
          const count = n.id === "pipeline" ? leadCounts.total : null;
          return (
            <div key={n.id} className={"nav-item " + (active ? "active" : "")} onClick={() => setView(n.id)}>
              <div className="nav-icon" style={{
                background: active ? `var(--${n.tone})` : "var(--paper-3)",
                color: active ? `var(--${n.tone}-ink)` : "var(--ink-2)",
              }}>
                <Icon name={n.icon} size={14} stroke={1.8}/>
              </div>
              <span style={{ flex: 1 }}>{n.label}</span>
              {count != null && (
                <span className="mono tabular" style={{
                  fontSize: 10.5, fontWeight: 600,
                  color: active ? `var(--${n.tone}-ink)` : "var(--ink-3)",
                  background: active ? `var(--${n.tone})` : "var(--paper-3)",
                  padding: "2px 7px", borderRadius: 999,
                }}>{count}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Section: Pipeline status */}
      <div className="eyebrow" style={{ padding: "16px 12px 4px 12px" }}>Status breakdown</div>
      <div className="col gap-1">
        {[
          ["evaluating", "Evaluating", "yellow",  leadCounts.evaluating],
          ["tailoring",  "Tailoring",  "purple",  leadCounts.tailoring],
          ["approved",   "Approved",   "green",   leadCounts.approved],
          ["applied",    "Applied",    "orange",  leadCounts.applied],
        ].map(([k, label, tone, n]) => (
          <div key={k} className="row" style={{
            padding: "7px 12px", fontSize: 12, color: "var(--ink-2)", justifyContent: "space-between",
            borderRadius: 8,
          }}>
            <div className="row gap-2">
              <span style={{ width: 8, height: 8, borderRadius: 3, background: `var(--${tone})`, border: `1px solid var(--${tone}-ink)`, opacity: 0.85 }}/>
              <span>{label}</span>
            </div>
            <span className="mono tabular" style={{ color: "var(--ink-3)", fontSize: 11 }}>{n || 0}</span>
          </div>
        ))}
      </div>

      <div className="grow"/>

      {/* Footer: status + gear */}
      <div className="card-flat" style={{ padding: 10, background: "var(--card)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="col" style={{ gap: 2 }}>
            <div className="row gap-2">
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: online ? "var(--ok)" : "var(--bad)",
                boxShadow: `0 0 0 3px ${online ? 'rgba(91,140,68,0.18)' : 'rgba(180,69,44,0.18)'}`,
                animation: online ? "blink 2s ease-in-out infinite" : "none",
              }}/>
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>{online ? "Online" : "Offline"}</span>
            </div>
            <span className="mono tabular" style={{ fontSize: 10, color: "var(--ink-3)" }}>{latency}ms · up {uptime}</span>
          </div>
          <button className="btn btn-icon" onClick={onSettings} aria-label="Settings"><Icon name="settings" size={15}/></button>
        </div>
      </div>
    </aside>
  );
};

window.Sidebar = Sidebar;
window.NAV = NAV;
