// Approval Drawer with FIRE button
const Drawer = ({ lead, onClose, onFire }) => {
  const [holding, setHolding] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [fired, setFired] = React.useState(false);
  const intRef = React.useRef(null);

  React.useEffect(() => {
    if (holding && !fired) {
      intRef.current = setInterval(() => {
        setProgress(p => {
          const next = p + 4;
          if (next >= 100) {
            clearInterval(intRef.current);
            setFired(true);
            setTimeout(() => { onFire(lead); }, 700);
            return 100;
          }
          return next;
        });
      }, 22);
    } else if (!holding && !fired) {
      clearInterval(intRef.current);
      setProgress(0);
    }
    return () => clearInterval(intRef.current);
  }, [holding, fired]);

  if (!lead) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <div style={{
        position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)",
        width: "min(1240px, calc(100vw - 48px))",
        height: "min(720px, calc(100vh - 48px))",
        background: "var(--paper)", border: "1px solid var(--line)",
        borderRadius: 24, boxShadow: "var(--shadow-lg)",
        zIndex: 50, overflow: "hidden",
        display: "grid", gridTemplateColumns: "1.4fr 1fr",
        animation: "slide-up .35s ease",
      }}>
        {/* LEFT — PDF preview */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)", background: "var(--paper-2)", overflow: "hidden" }}>
          <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", justifyContent: "space-between", background: "var(--card)" }}>
            <div className="row gap-2">
              <Icon name="file" size={14} color="var(--accent)"/>
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 500 }}>resume_{lead.id.split("-")[1]}.pdf</span>
              <span className="pill" style={{ background: "var(--green)", color: "var(--green-ink)", fontSize: 10 }}>tailored</span>
            </div>
            <div className="row gap-2">
              <button className="btn btn-icon"><Icon name="external" size={13}/></button>
            </div>
          </div>
          <div style={{ flex: 1, padding: 28, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
            <FakeResume lead={lead}/>
          </div>
        </div>

        {/* RIGHT — Reasoning + FIRE */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--card)" }}>
          <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
            <span className="eyebrow">Approval</span>
            <button className="btn btn-icon" onClick={onClose}><Icon name="x" size={14}/></button>
          </div>
          <div className="scroll" style={{ padding: 22, flex: 1 }}>
            <div className="row gap-3" style={{ marginBottom: 16 }}>
              <CompanyMark tone={lead.tone} mark={lead.mark} size={48}/>
              <div className="col gap-1">
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{lead.company} · {lead.platform}</div>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.2 }}>{lead.title}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{lead.location} · {lead.salary}</div>
              </div>
            </div>

            {/* Match score block */}
            <div style={{
              padding: 16, borderRadius: 14,
              background: `var(--${lead.tone}-soft)`,
              border: `1px solid var(--${lead.tone})`,
              marginBottom: 14,
            }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <span className="eyebrow" style={{ color: `var(--${lead.tone}-ink)` }}>Graph match</span>
                <span className="mono tabular" style={{ fontSize: 12, fontWeight: 600, color: `var(--${lead.tone}-ink)` }}>{lead.match}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "var(--card)", overflow: "hidden" }}>
                <div style={{ width: `${lead.match}%`, height: "100%", background: `var(--${lead.tone}-ink)`, borderRadius: 999 }}/>
              </div>
            </div>

            <div className="eyebrow" style={{ marginBottom: 8 }}>Why this is a match</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1.35, color: "var(--ink)", marginBottom: 16, letterSpacing: "-0.01em" }}>
              <span className="italic-serif" style={{ color: "var(--accent)" }}>“</span>{lead.reasoning}<span className="italic-serif" style={{ color: "var(--accent)" }}>”</span>
            </div>

            <div className="col gap-2" style={{ marginBottom: 16 }}>
              {[
                { tone: "green",  k: "Skills overlap",     v: "9 of 11 required" },
                { tone: "blue",   k: "Experience match",   v: "7 yrs vs 5+ asked" },
                { tone: "purple", k: "Comp band fit",      v: lead.salary },
                { tone: "yellow", k: "ATS confidence",     v: "high" },
              ].map((r, i) => (
                <div key={i} className="row" style={{
                  justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 9,
                  background: `var(--${r.tone}-soft)`,
                  border: `1px solid var(--${r.tone})`,
                }}>
                  <span style={{ fontSize: 12.5, color: `var(--${r.tone}-ink)`, fontWeight: 500 }}>{r.k}</span>
                  <span className="mono tabular" style={{ fontSize: 11.5, color: "var(--ink-2)", fontWeight: 500 }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FIRE area */}
          <div style={{ padding: 18, borderTop: "1px solid var(--line)", background: "var(--paper-2)" }}>
            <div className="row gap-2" style={{ marginBottom: 12, justifyContent: "space-between" }}>
              <button className="btn"><Icon name="file" size={13}/> Edit résumé</button>
              <button className="btn"><Icon name="x" size={13}/> Reject</button>
            </div>
            <button
              onMouseDown={() => setHolding(true)}
              onMouseUp={() => setHolding(false)}
              onMouseLeave={() => setHolding(false)}
              onTouchStart={() => setHolding(true)}
              onTouchEnd={() => setHolding(false)}
              disabled={fired}
              style={{
                width: "100%", padding: "16px 20px",
                background: fired ? "var(--green)" : "var(--accent)",
                color: fired ? "var(--green-ink)" : "white",
                border: `1px solid ${fired ? "var(--green-ink)" : "var(--accent-2)"}`,
                borderRadius: 14, cursor: fired ? "default" : "pointer",
                fontSize: 15, fontWeight: 600, letterSpacing: "0.02em",
                position: "relative", overflow: "hidden",
                boxShadow: holding ? "0 0 0 4px var(--coral-soft), var(--shadow-md)" : "var(--shadow-md)",
                transition: "all .15s ease",
              }}
            >
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${progress}%`,
                background: "rgba(255,255,255,0.18)",
                transition: "width .05s linear",
              }}/>
              <div className="row gap-2" style={{ justifyContent: "center", position: "relative" }}>
                {fired ? (
                  <><Icon name="check" size={16}/> APPLICATION FIRED</>
                ) : (
                  <><Icon name="fire" size={16}/> {holding ? "HOLD TO FIRE…" : "PRESS & HOLD TO FIRE"}</>
                )}
              </div>
            </button>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center", marginTop: 8 }}>
              triggers playwright · submits to {lead.platform.toLowerCase()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const FakeResume = ({ lead }) => (
  <div style={{
    width: 460, minHeight: 600,
    background: "white", border: "1px solid var(--line)",
    borderRadius: 6, padding: "44px 40px",
    boxShadow: "var(--shadow-md)",
    fontFamily: "var(--font-sans)",
  }}>
    <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 400, letterSpacing: "-0.02em", marginBottom: 4 }}>Alex Chen</div>
    <div className="mono" style={{ fontSize: 10, color: "#7A6F62", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18 }}>
      {lead.title} · alex@chen.dev · sf
    </div>
    <div style={{ height: 1, background: "var(--line)", marginBottom: 14 }}/>

    <div className="eyebrow" style={{ marginBottom: 6, color: `var(--${lead.tone}-ink)` }}>Tailored summary</div>
    <div style={{ fontSize: 11.5, lineHeight: 1.55, color: "#4A3F33", marginBottom: 18 }}>
      Senior engineer with 7 years building real-time, collaborative systems. Shipped a Linear-style editor used by 12k teams, contributed core modules to LangChain, and operated graph-backed inference at scale.
    </div>

    <div className="eyebrow" style={{ marginBottom: 8 }}>Experience</div>
    {EXPERIENCES.map((e, i) => (
      <div key={i} style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{e.role}, <span style={{ fontWeight: 400 }}>{e.company}</span></div>
          <div className="mono" style={{ fontSize: 10, color: "#7A6F62" }}>{e.period}</div>
        </div>
        <div style={{ fontSize: 11, color: "#4A3F33", marginTop: 4, lineHeight: 1.5 }}>
          • Led platform team of 6 · shipped 3 collaborative products<br/>
          • Reduced p95 latency 38% across realtime layer
        </div>
      </div>
    ))}

    <div className="eyebrow" style={{ marginBottom: 8, marginTop: 4 }}>Skills <span style={{ fontWeight: 400, fontStyle: "italic", textTransform: "none", letterSpacing: 0, color: `var(--${lead.tone}-ink)` }}>· emphasized for {lead.company}</span></div>
    <div className="row gap-2" style={{ flexWrap: "wrap" }}>
      {SKILLS.slice(0, 8).map(s => (
        <span key={s.name} className="mono" style={{ fontSize: 10, padding: "2px 7px", border: "1px solid var(--line)", borderRadius: 4 }}>{s.name}</span>
      ))}
    </div>
  </div>
);

window.Drawer = Drawer;
