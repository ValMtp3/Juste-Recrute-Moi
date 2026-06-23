// Pipeline Dashboard — matte, no glass
const STATUS_TONES = {
  discovered: { bg: "var(--st-discovered-bg)", fg: "var(--st-discovered-fg)", label: "Discovered" },
  evaluating: { bg: "var(--st-evaluating-bg)", fg: "var(--st-evaluating-fg)", label: "Evaluating" },
  tailoring:  { bg: "var(--st-tailoring-bg)",  fg: "var(--st-tailoring-fg)",  label: "Tailoring"  },
  approved:   { bg: "var(--st-approved-bg)",   fg: "var(--st-approved-fg)",   label: "Approved"   },
  applied:    { bg: "var(--st-applied-bg)",    fg: "var(--st-applied-fg)",    label: "Applied"    },
  rejected:   { bg: "var(--st-rejected-bg)",   fg: "var(--st-rejected-fg)",   label: "Rejected"   },
};

const StatusPill = ({ status }) => {
  const c = STATUS_TONES[status] || STATUS_TONES.discovered;
  return (
    <span className="pill" style={{ color: c.fg, background: c.bg }}>
      <span className="dot" style={{ background: c.fg }}/>
      {c.label}
    </span>
  );
};

const JobCard = ({ lead, onClick, active }) => {
  const c = STATUS_TONES[lead.status];
  return (
    <button onClick={onClick} className="lift" style={{
      textAlign: "left", width: "100%", display: "block",
      flex: "0 0 auto",
      border: "1px solid " + (active ? "var(--ink-3)" : "var(--line)"),
      background: active ? "var(--card-2)" : "var(--card)",
      borderRadius: 14, padding: "13px 14px", cursor: "pointer",
      boxShadow: active ? "var(--shadow-md)" : "var(--shadow-sm)",
      position: "relative", overflow: "hidden",
    }}>
      <span style={{
        position: "absolute", left: 0, top: 12, bottom: 12, width: 3, borderRadius: 4,
        background: c.fg, opacity: 0.7,
      }}/>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginLeft: 8 }}>
        <div className="col gap-1" style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink)" }}>
            {lead.title}
          </div>
          <div className="row gap-2" style={{ fontSize: 12, color: "var(--ink-2)" }}>
            <span style={{ fontWeight: 500 }}>{lead.company}</span>
            <span style={{ color: "var(--ink-4)" }}>·</span>
            <span style={{ color: "var(--ink-3)" }}>{lead.location}</span>
          </div>
        </div>
        <div className="col gap-1" style={{ alignItems: "flex-end" }}>
          <div className="mono" style={{
            fontSize: 11, fontWeight: 600,
            color: lead.match >= 90 ? "var(--ok)" : lead.match >= 80 ? "var(--warn)" : "var(--ink-3)",
          }}>{lead.match}%</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{lead.posted}</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 10, marginLeft: 8, justifyContent: "space-between", alignItems: "center" }}>
        <StatusPill status={lead.status}/>
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{lead.platform}</span>
      </div>
    </button>
  );
};

const DiscoveryFeed = ({ leads, selected, onSelect, filter, setFilter }) => {
  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);
  const counts = leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});

  return (
    <div className="card col" style={{ height: "100%", overflow: "hidden" }}>
      <div className="col gap-3" style={{ padding: "16px 16px 12px 16px", borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="col gap-1">
            <span className="eyebrow">Column 01 · Discovery</span>
            <h3 style={{ fontSize: 18, color: "var(--ink)" }}>Live pipeline <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· {leads.length}</span></h3>
          </div>
          <button className="btn btn-icon" aria-label="Refresh"><Icon name="refresh" size={15}/></button>
        </div>
        <div className="row gap-1" style={{ flexWrap: "wrap" }}>
          {[["all","All", leads.length], ...Object.entries(STATUS_TONES).map(([k,v]) => [k, v.label, counts[k]||0])].map(([k, label, n]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500,
              border: "1px solid " + (filter === k ? "var(--ink)" : "var(--line)"),
              background: filter === k ? "var(--ink)" : "transparent",
              color: filter === k ? "var(--paper)" : "var(--ink-2)",
              cursor: "pointer",
            }}>
              {label} <span style={{ opacity: 0.55, marginLeft: 4 }}>{n}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="col gap-2" style={{ padding: 12, overflowY: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--ink-3)", fontSize: 13 }}>No leads in this state.</div>
        ) : filtered.map(l => (
          <JobCard key={l.id} lead={l} active={selected?.id === l.id} onClick={() => onSelect(l)}/>
        ))}
      </div>
    </div>
  );
};

const LOG_COLORS = {
  info: "var(--ink-2)",
  ok:   "var(--ok)",
  warn: "var(--warn)",
  err:  "var(--bad)",
};

const AgentTerminal = ({ logs, paused, setPaused, ghost }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && !paused) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs, paused]);

  return (
    <div className="card col" style={{ height: "100%", overflow: "hidden" }}>
      <div className="row" style={{
        padding: "16px 16px 14px 16px", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid var(--line)",
      }}>
        <div className="col gap-1">
          <span className="eyebrow">Column 02 · Agent Stream</span>
          <h3 style={{ fontSize: 18 }}>Thoughts <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· langgraph</span></h3>
        </div>
        <div className="row gap-2">
          <span className="pill" style={{
            color: ghost ? "var(--mauve-ink)" : "var(--ink-2)",
            background: ghost ? "var(--mauve)" : "var(--paper-2)",
          }}>
            <Icon name="ghost" size={11}/>
            {ghost ? "Ghost Mode" : "Human-in-loop"}
          </span>
          <button className="btn btn-icon" onClick={() => setPaused(p => !p)}>
            <Icon name={paused ? "play" : "pause"} size={14}/>
          </button>
        </div>
      </div>

      <div ref={ref} className="terminal" style={{
        flex: 1, overflowY: "auto", padding: "14px 16px 16px 16px",
        background: "var(--paper-2)",
        margin: 12, borderRadius: 12,
        border: "1px solid var(--line)",
      }}>
        {logs.map((log, i) => (
          <div key={i} className="row gap-3" style={{ alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ color: "var(--ink-4)", fontSize: 10.5 }}>{log.t}</span>
            <span style={{
              color: LOG_COLORS[log.lvl], fontSize: 10, fontWeight: 600, textTransform: "uppercase",
              minWidth: 36, letterSpacing: "0.06em",
            }}>{log.lvl}</span>
            <span style={{ color: "var(--ink-2)", flex: 1 }}>{log.msg}</span>
          </div>
        ))}
        <div className="row gap-2" style={{ marginTop: 6, color: "var(--ink-2)" }}>
          <span style={{ color: "var(--accent)" }}>›</span>
          <span className="blink" style={{
            display: "inline-block", width: 7, height: 13,
            background: "var(--ink-2)", verticalAlign: "middle",
          }}/>
        </div>
      </div>
    </div>
  );
};

const KnowledgeGraph = ({ stats }) => {
  const labels = Object.keys(stats);
  const values = Object.values(stats);
  const max = Math.max(...values);
  const cx = 130, cy = 130, R = 92;
  const points = labels.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI / 5);
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R, a];
  });
  const valuePts = labels.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI / 5);
    const r = (values[i] / max) * R * 0.88 + 12;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

  const swatches = ["var(--sage)", "var(--mauve)", "var(--clay)", "var(--sky)", "var(--butter)"];

  return (
    <div className="card col" style={{ height: "100%", overflow: "hidden" }}>
      <div className="row" style={{
        padding: "16px", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid var(--line)",
      }}>
        <div className="col gap-1">
          <span className="eyebrow">Column 03 · Knowledge</span>
          <h3 style={{ fontSize: 18 }}>Local graph <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· kùzu</span></h3>
        </div>
        <span className="pill" style={{ color: "var(--sage-ink)", background: "var(--sage)" }}>
          <span className="dot"/> healthy
        </span>
      </div>

      <div className="col" style={{ flex: 1, padding: "10px 18px 18px 18px", overflowY: "auto", alignItems: "center" }}>
        <svg viewBox="0 0 260 260" style={{ width: "100%", maxWidth: 240, marginTop: 4 }}>
          {[0.25, 0.5, 0.75, 1].map((s, i) => (
            <polygon key={i} points={points.map(([x,y]) => {
              const px = cx + (x - cx) * s, py = cy + (y - cy) * s;
              return `${px},${py}`;
            }).join(" ")} fill="none" stroke="var(--line-2)" strokeWidth="1"/>
          ))}
          {points.map(([x, y], i) => (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-2)" strokeWidth="1"/>
          ))}
          <polygon points={valuePts.map(p => p.join(",")).join(" ")}
            fill="var(--accent-soft)"
            stroke="var(--accent)" strokeWidth="1.5"
            fillOpacity="0.85"
          />
          {valuePts.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="5.5" fill="var(--card)" stroke="var(--accent)" strokeWidth="1.5"/>
              <circle cx={x} cy={y} r="2" fill="var(--accent)"/>
            </g>
          ))}
          {points.map(([x, y, a], i) => {
            const lx = cx + Math.cos(a) * (R + 22);
            const ly = cy + Math.sin(a) * (R + 22);
            return (
              <g key={i} transform={`translate(${lx}, ${ly})`}>
                <text textAnchor="middle" style={{ fontSize: 9.5, fontFamily: "Geist Mono, monospace", fill: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }} dy="-4">{labels[i]}</text>
                <text textAnchor="middle" style={{ fontSize: 14, fontWeight: 600, fontFamily: "Geist Mono, monospace", fill: "var(--ink)" }} dy="10">{values[i].toLocaleString()}</text>
              </g>
            );
          })}
        </svg>

        <div className="col gap-2" style={{ width: "100%", marginTop: 16 }}>
          {labels.map((l, i) => (
            <div key={l} className="row" style={{
              justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px", borderRadius: 10,
              background: "var(--paper-2)", border: "1px solid var(--line)",
            }}>
              <div className="row gap-2">
                <span style={{
                  width: 10, height: 10, borderRadius: 3,
                  background: swatches[i],
                  border: "1px solid var(--line-2)",
                }}/>
                <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{l}</span>
              </div>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{values[i].toLocaleString()}</span>
            </div>
          ))}
          <div className="row" style={{
            justifyContent: "space-between", alignItems: "center",
            padding: "10px 12px", borderRadius: 10, marginTop: 4,
            background: "var(--accent-soft)", border: "1px solid color-mix(in oklch, var(--accent) 30%, transparent)",
          }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--accent-2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>db size</span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-2)" }}>4.2 MB · 212 nodes</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Pipeline = ({ leads, selected, onSelect, logs, paused, setPaused, ghost, filter, setFilter }) => {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(340px, 1.35fr) minmax(280px, 1fr)",
      gap: 14, padding: "0 22px 22px 22px", flex: 1, minHeight: 0, marginTop: 14,
    }}>
      <DiscoveryFeed leads={leads} selected={selected} onSelect={onSelect} filter={filter} setFilter={setFilter}/>
      <AgentTerminal logs={logs} paused={paused} setPaused={setPaused} ghost={ghost}/>
      <KnowledgeGraph stats={GRAPH}/>
    </div>
  );
};

window.Pipeline = Pipeline;
window.StatusPill = StatusPill;
window.STATUS_TONES = STATUS_TONES;
