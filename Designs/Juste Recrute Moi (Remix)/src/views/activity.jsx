// Activity — full-page log + agent status
const ActivityView = ({ terminal }) => {
  const agents = [
    { name: "Scraper · Lever",      state: "active",  tone: "green",  task: "polling lever.co/* boards"   },
    { name: "Scraper · Greenhouse", state: "idle",    tone: "blue",   task: "next run in 4m 12s"          },
    { name: "Scraper · LinkedIn",   state: "throttle",tone: "yellow", task: "backing off · 47s remaining" },
    { name: "Evaluator",            state: "active",  tone: "green",  task: "scoring 3 leads in parallel" },
    { name: "Tailor (resume)",      state: "active",  tone: "green",  task: "regenerating PDF for #1042"  },
    { name: "Playwright actuator",  state: "armed",   tone: "purple", task: "awaiting fire signal"        },
  ];
  return (
    <div className="scroll" style={{ padding: 24, flex: 1 }}>
      <div className="card" style={{ padding: "26px 28px", marginBottom: 18, background: "var(--orange-soft)" }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div className="col gap-2" style={{ maxWidth: 540 }}>
            <span className="eyebrow">Real-time stream</span>
            <h1 style={{ fontSize: 44 }}>What is the agent <span className="italic-serif">thinking?</span></h1>
            <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
              Every step the LangGraph orchestrator takes lands here as a structured event. Filter by agent, severity, or job lead.
            </div>
          </div>
          <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
            <span className="eyebrow">Events / min</span>
            <span className="display tabular" style={{ fontSize: 56, color: "var(--orange-ink)", lineHeight: 1 }}>14.2</span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>↑ 18% vs avg</span>
          </div>
        </div>
      </div>

      {/* Agent strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 18 }}>
        {agents.map((a, i) => (
          <div key={i} className="card-flat" style={{ padding: 14, background: `var(--${a.tone}-soft)`, border: `1px solid var(--${a.tone})` }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: `var(--${a.tone})`, color: `var(--${a.tone}-ink)`, letterSpacing: "0.1em", textTransform: "uppercase" }}>{a.state}</span>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--${a.tone}-ink)` }} className={a.state === "active" ? "pulse-soft" : ""}/>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{a.name}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{a.task}</div>
          </div>
        ))}
      </div>

      {/* Big terminal */}
      <div className="card" style={{ padding: 18, background: "var(--purple-soft)" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3>Stream</h3>
          <div className="row gap-2">
            <span className="pill" style={{ background: "var(--green)", color: "var(--green-ink)" }}>
              <span className="dot pulse-soft"/> live
            </span>
            <button className="btn btn-icon"><Icon name="pause" size={13}/></button>
            <button className="btn"><Icon name="filter" size={13}/> filter</button>
          </div>
        </div>
        <div style={{ height: 440, display: "flex" }}>
          <div className="scroll terminal" style={{
            background: "#1F1A14", color: "#EFE7D6",
            borderRadius: 12, padding: "14px 16px", flex: 1,
          }}>
            {terminal.map((ln, i) => {
              const tone = { info: "blue", ok: "green", warn: "yellow", err: "pink" }[ln.lvl];
              return (
                <div key={i} className="row gap-3" style={{ marginBottom: 5, alignItems: "baseline" }}>
                  <span className="mono tabular" style={{ color: "#7A6F62", fontSize: 10.5, minWidth: 50 }}>{String(i).padStart(4, "0")}</span>
                  <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "1px 6px", borderRadius: 4, background: `var(--${tone})`, color: `var(--${tone}-ink)`, minWidth: 42, textAlign: "center" }}>{ln.lvl}</span>
                  <span style={{ color: "#B5AC9D", fontSize: 11 }}>{ln.t}</span>
                  <span style={{ flex: 1 }}>{ln.m}</span>
                </div>
              );
            })}
            <div className="row gap-2" style={{ marginTop: 4 }}>
              <span style={{ color: "#7A6F62" }}>{String(terminal.length).padStart(4, "0")}</span>
              <span style={{ color: "var(--accent)" }}>›</span>
              <span className="blink">▌</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
window.ActivityView = ActivityView;
