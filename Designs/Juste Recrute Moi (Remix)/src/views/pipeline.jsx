// Pipeline view — 3-column command center, the heart of the app
const StatusPill = ({ status }) => {
  const meta = STATUS_TONE[status] || STATUS_TONE.discovered;
  return (
    <span className="pill mono" style={{
      background: `var(--${meta.tone})`, color: `var(--${meta.tone}-ink)`,
      fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600,
    }}>
      <span className="dot"/>
      {meta.label}
    </span>
  );
};

const CompanyMark = ({ tone, mark, size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: 10,
    background: `var(--${tone})`, color: `var(--${tone}-ink)`,
    display: "grid", placeItems: "center",
    fontFamily: "var(--font-display)", fontSize: size * 0.5,
    fontWeight: 500, flexShrink: 0,
    border: `1px solid var(--${tone}-ink)`,
  }}>{mark}</div>
);

const JobCard = ({ lead, onClick, active }) => {
  return (
    <div className="lift" onClick={onClick} style={{
      background: active ? `var(--${lead.tone}-soft)` : "var(--card)",
      border: `1px solid ${active ? `var(--${lead.tone}-ink)` : "var(--line)"}`,
      borderRadius: 14, padding: 14, cursor: "pointer",
      boxShadow: active ? "var(--shadow-md)" : "var(--shadow-xs)",
    }}>
      <div className="row gap-3" style={{ alignItems: "flex-start" }}>
        <CompanyMark tone={lead.tone} mark={lead.mark}/>
        <div className="col gap-1" style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{lead.company}</div>
            <span className="mono tabular" style={{ fontSize: 10, color: "var(--ink-3)" }}>{lead.posted}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.01em" }}>{lead.title}</div>
          <div className="row gap-2 mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>
            <span>{lead.location}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{lead.platform}</span>
          </div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 12, alignItems: "center" }}>
        <StatusPill status={lead.status}/>
        <div className="row gap-2">
          <div className="mono tabular" style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-2)" }}>
            {lead.match}<span style={{ color: "var(--ink-3)", fontWeight: 400 }}>%</span>
          </div>
          <div style={{ width: 38, height: 4, borderRadius: 999, background: "var(--paper-3)", overflow: "hidden" }}>
            <div style={{ width: `${lead.match}%`, height: "100%", background: `var(--${lead.tone}-ink)`, opacity: 0.7 }}/>
          </div>
        </div>
      </div>
    </div>
  );
};

const Terminal = ({ lines }) => {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines.length]);
  const lvlTone = { info: "blue", ok: "green", warn: "yellow", err: "pink" };
  return (
    <div ref={ref} className="scroll terminal" style={{
      background: "#1F1A14",
      borderRadius: 12, padding: "14px 16px",
      flex: 1, minHeight: 0,
      color: "#EFE7D6",
    }}>
      {lines.map((ln, i) => {
        const tone = lvlTone[ln.lvl] || "blue";
        return (
          <div key={i} className="row gap-3" style={{ marginBottom: 5, alignItems: "baseline" }}>
            <span className="mono tabular" style={{ color: "#7A6F62", fontSize: 10.5, minWidth: 50 }}>{String(i).padStart(4, "0")}</span>
            <span className="mono" style={{
              fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
              padding: "1px 6px", borderRadius: 4,
              background: `var(--${tone})`, color: `var(--${tone}-ink)`,
              minWidth: 42, textAlign: "center",
            }}>{ln.lvl}</span>
            <span style={{ color: "#B5AC9D", fontSize: 11 }}>{ln.t}</span>
            <span style={{ color: "#EFE7D6", flex: 1 }}>{ln.m}</span>
          </div>
        );
      })}
      <div className="row gap-2" style={{ marginTop: 4 }}>
        <span style={{ color: "#7A6F62" }}>{String(lines.length).padStart(4, "0")}</span>
        <span style={{ color: "var(--accent)" }}>›</span>
        <span className="blink">▌</span>
      </div>
    </div>
  );
};

const PentagonGraph = ({ stats }) => {
  const cx = 130, cy = 125, R = 80;
  const max = Math.max(...stats.map(s => s.count));
  const pts = stats.map((s, i) => {
    const angle = -Math.PI/2 + (i * 2 * Math.PI / 5);
    const r = R * (0.25 + 0.75 * (s.count / max));
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, label: s.key, count: s.count, tone: s.tone, fullX: cx + Math.cos(angle) * R, fullY: cy + Math.sin(angle) * R };
  });
  const polyPts = pts.map(p => `${p.x},${p.y}`).join(" ");
  const fullPolyPts = pts.map(p => `${p.fullX},${p.fullY}`).join(" ");
  return (
    <svg viewBox="0 0 260 260" style={{ width: "100%", height: "auto" }}>
      <defs>
        <radialGradient id="penta-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C96442" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#C96442" stopOpacity="0.12"/>
        </radialGradient>
      </defs>
      {/* Concentric guides */}
      {[0.25, 0.5, 0.75, 1].map(s => (
        <polygon key={s} points={pts.map((p,i) => {
          const angle = -Math.PI/2 + (i * 2 * Math.PI / 5);
          return `${cx + Math.cos(angle) * R * s},${cy + Math.sin(angle) * R * s}`;
        }).join(" ")} fill="none" stroke="var(--line)" strokeWidth="1"/>
      ))}
      {/* Spokes */}
      {pts.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.fullX} y2={p.fullY} stroke="var(--line)" strokeWidth="1"/>
      ))}
      {/* Filled data polygon */}
      <polygon points={polyPts} fill="url(#penta-fill)" stroke="var(--accent)" strokeWidth="1.5"/>
      {/* Nodes */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="6" fill={`var(--${p.tone})`} stroke={`var(--${p.tone}-ink)`} strokeWidth="1.5"/>
        </g>
      ))}
      {/* Labels at outer ring */}
      {pts.map((p, i) => {
        const angle = -Math.PI/2 + (i * 2 * Math.PI / 5);
        const lx = cx + Math.cos(angle) * (R + 28);
        const ly = cy + Math.sin(angle) * (R + 28);
        return (
          <g key={"lbl"+i}>
            <text x={lx} y={ly - 2} textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fill: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>{p.label}</text>
            <text x={lx} y={ly + 11} textAnchor="middle" style={{ fontFamily: "var(--font-display)", fontSize: 16, fill: "var(--ink)", fontWeight: 400 }}>{p.count}</text>
          </g>
        );
      })}
    </svg>
  );
};

const PipelineView = ({ leads, terminal, openDrawer }) => {
  const [filter, setFilter] = React.useState("all");
  const [activeId, setActiveId] = React.useState(null);
  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);
  const filters = [
    { id: "all",        label: "All",        n: leads.length },
    { id: "evaluating", label: "Evaluating", n: leads.filter(l=>l.status==="evaluating").length },
    { id: "tailoring",  label: "Tailoring",  n: leads.filter(l=>l.status==="tailoring").length },
    { id: "approved",   label: "Approved",   n: leads.filter(l=>l.status==="approved").length },
    { id: "applied",    label: "Applied",    n: leads.filter(l=>l.status==="applied").length },
  ];
  return (
    <div className="grid-3" style={{ padding: 24, height: "100%", overflow: "hidden" }}>
      {/* COL 1 — Discovery feed */}
      <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--blue-soft)" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--line)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="row gap-2">
              <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--blue)", color: "var(--blue-ink)", display: "grid", placeItems: "center" }}>
                <Icon name="layers" size={14}/>
              </div>
              <div>
                <h3>Discovery</h3>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{filtered.length} leads</div>
              </div>
            </div>
            <button className="btn btn-icon"><Icon name="filter" size={14}/></button>
          </div>
          <div className="row gap-1" style={{ flexWrap: "wrap" }}>
            {filters.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} className="mono" style={{
                padding: "4px 9px", borderRadius: 7, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                border: "1px solid " + (filter === f.id ? "var(--ink)" : "var(--line)"),
                background: filter === f.id ? "var(--ink)" : "var(--card)",
                color: filter === f.id ? "var(--paper)" : "var(--ink-2)",
                cursor: "pointer",
              }}>{f.label}<span style={{ marginLeft: 5, opacity: 0.6 }}>{f.n}</span></button>
            ))}
          </div>
        </div>
        <div className="scroll col gap-2" style={{ padding: 12, flex: 1, minHeight: 0 }}>
          {filtered.map(l => (
            <JobCard key={l.id} lead={l} active={activeId === l.id}
              onClick={() => { setActiveId(l.id); if (l.status === "approved" || l.status === "tailoring") openDrawer(l); }}/>
          ))}
        </div>
      </div>

      {/* COL 2 — Agent Thoughts */}
      <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--purple-soft)" }}>
        <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid var(--line)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row gap-2">
              <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--purple)", color: "var(--purple-ink)", display: "grid", placeItems: "center" }}>
                <Icon name="pulse" size={14}/>
              </div>
              <div>
                <h3>Agent Thoughts</h3>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>LangGraph · live</div>
              </div>
            </div>
            <div className="row gap-2">
              <span className="pill" style={{ background: "var(--green)", color: "var(--green-ink)", fontSize: 10 }}>
                <span className="dot pulse-soft"/> streaming
              </span>
              <button className="btn btn-icon"><Icon name="pause" size={13}/></button>
            </div>
          </div>
        </div>
        <div style={{ padding: 14, flex: 1, minHeight: 0, display: "flex" }}>
          <Terminal lines={terminal}/>
        </div>
      </div>

      {/* COL 3 — Knowledge graph */}
      <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--green-soft)" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--line)" }}>
          <div className="row gap-2">
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--green)", color: "var(--green-ink)", display: "grid", placeItems: "center" }}>
              <Icon name="graph" size={14}/>
            </div>
            <div>
              <h3>Knowledge graph</h3>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>kùzu · local</div>
            </div>
          </div>
        </div>
        <div className="scroll" style={{ padding: 14, flex: 1, minHeight: 0 }}>
          <div className="card-flat" style={{ padding: 14, marginBottom: 12 }}>
            <PentagonGraph stats={GRAPH_STATS}/>
          </div>
          <div className="col gap-2">
            {GRAPH_STATS.map(s => (
              <div key={s.key} className="row" style={{
                justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", borderRadius: 10,
                background: `var(--${s.tone}-soft)`,
                border: `1px solid var(--${s.tone})`,
              }}>
                <div className="row gap-2">
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: `var(--${s.tone}-ink)` }}/>
                  <span style={{ fontSize: 12, fontWeight: 500, color: `var(--${s.tone}-ink)` }}>{s.key}</span>
                </div>
                <span className="display tabular" style={{ fontSize: 22, color: `var(--${s.tone}-ink)` }}>{s.count}</span>
              </div>
            ))}
          </div>
          <div className="row gap-2" style={{ marginTop: 14 }}>
            <button className="btn" style={{ flex: 1 }}><Icon name="external" size={13}/> Inspect</button>
            <button className="btn btn-primary" style={{ flex: 1 }}><Icon name="plus" size={13}/> Add node</button>
          </div>
        </div>
      </div>
    </div>
  );
};

window.PipelineView = PipelineView;
window.JobCard = JobCard;
window.StatusPill = StatusPill;
window.CompanyMark = CompanyMark;
window.PentagonGraph = PentagonGraph;
