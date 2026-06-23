// Dashboard — overview / hero page
const StatCard = ({ tone, label, value, sub, icon, accent }) => (
  <div style={{
    background: `var(--${tone}-soft)`,
    border: `1px solid var(--${tone})`,
    borderRadius: 16, padding: 18,
    display: "flex", flexDirection: "column", gap: 12,
    minHeight: 132,
  }}>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: `var(--${tone})`, color: `var(--${tone}-ink)`,
        display: "grid", placeItems: "center",
      }}>
        <Icon name={icon} size={15}/>
      </div>
      {accent && (
        <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: `var(--${tone}-ink)`, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {accent}
        </div>
      )}
    </div>
    <div className="col" style={{ gap: 4 }}>
      <div className="display tabular" style={{ fontSize: 40, color: `var(--${tone}-ink)`, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{label}</div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{sub}</div>
    </div>
  </div>
);

const SparkBar = ({ data, tone }) => {
  const max = Math.max(...data);
  return (
    <div className="row" style={{ gap: 3, alignItems: "flex-end", height: 44 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1,
          height: `${(v/max)*100}%`,
          minHeight: 3,
          background: `var(--${tone}-ink)`,
          opacity: 0.4 + (v/max) * 0.6,
          borderRadius: 2,
        }}/>
      ))}
    </div>
  );
};

const DashboardView = ({ leads, terminal, setView, openDrawer }) => {
  const counts = {
    discovered: leads.filter(l=>l.status==="discovered").length,
    evaluating: leads.filter(l=>l.status==="evaluating").length,
    tailoring:  leads.filter(l=>l.status==="tailoring").length,
    approved:   leads.filter(l=>l.status==="approved").length,
    applied:    leads.filter(l=>l.status==="applied").length,
  };
  const recent = leads.slice(0, 4);
  const approvedQueue = leads.filter(l => l.status === "approved" || l.status === "tailoring").slice(0, 3);

  return (
    <div className="scroll" style={{ padding: 24, flex: 1 }}>
      {/* Hero strip */}
      <div className="card" style={{ padding: "26px 28px", marginBottom: 18, background: "linear-gradient(135deg, var(--orange-soft) 0%, var(--pink-soft) 60%, var(--purple-soft) 100%)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
          <div className="col gap-3" style={{ maxWidth: 560 }}>
            <span className="eyebrow">Today · April 25 · agent online</span>
            <h1 style={{ fontSize: 52 }}>Good morning. <span className="italic-serif" style={{ color: "var(--ink-2)" }}>The hunt is</span> on.</h1>
            <div style={{ fontSize: 14.5, color: "var(--ink-2)", lineHeight: 1.55, maxWidth: 480 }}>
              Your agents reviewed <b>{leads.length} new leads</b> overnight, tailored <b>{counts.tailoring + counts.approved} resumes</b>, and queued <b>{counts.approved} applications</b> ready for your call.
            </div>
            <div className="row gap-2" style={{ marginTop: 6 }}>
              <button className="btn btn-accent" onClick={() => setView("pipeline")}>Open pipeline <Icon name="arrow-right" size={13}/></button>
              <button className="btn" onClick={() => setView("activity")}><Icon name="pulse" size={13}/> Live activity</button>
            </div>
          </div>
          {/* Mini approval stack */}
          <div className="col gap-2" style={{ width: 320 }}>
            <div className="eyebrow" style={{ marginBottom: 2 }}>Awaiting your approval</div>
            {approvedQueue.length === 0 ? (
              <div className="card-flat" style={{ padding: 14, fontSize: 12, color: "var(--ink-3)" }}>Queue is clear.</div>
            ) : approvedQueue.map(l => (
              <div key={l.id} onClick={() => openDrawer(l)} className="lift" style={{
                background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12,
                padding: 10, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <CompanyMark tone={l.tone} mark={l.mark} size={32}/>
                <div className="col" style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l.company} · {l.match}% match</div>
                </div>
                <Icon name="arrow-right" size={14} color="var(--ink-3)"/>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard tone="blue"   label="Leads discovered" value={leads.length}      sub="Last 24h"      icon="layers"   accent="+12"/>
        <StatCard tone="yellow" label="Evaluating now"   value={counts.evaluating} sub="In agent loop" icon="spark"    accent="live"/>
        <StatCard tone="purple" label="Resumes tailored" value={counts.tailoring}  sub="PDFs cached"   icon="file"     accent="+3"/>
        <StatCard tone="green"  label="Awaiting approval" value={counts.approved}  sub="Ready to fire" icon="check"    accent="action"/>
        <StatCard tone="orange" label="Applications sent" value={counts.applied}   sub="This week"     icon="arrow-up" accent="+5"/>
      </div>

      {/* Two-up: chart + recent */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card" style={{ padding: 20, background: "var(--teal-soft)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <h3>Application velocity</h3>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>14-day rolling · agents combined</div>
            </div>
            <div className="row gap-1">
              {["7d","14d","30d"].map((p,i) => (
                <button key={p} className="mono" style={{
                  padding: "4px 9px", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                  border: "1px solid " + (i===1 ? "var(--teal-ink)" : "var(--line)"),
                  background: i===1 ? "var(--teal)" : "var(--card)",
                  color: i===1 ? "var(--teal-ink)" : "var(--ink-3)",
                  borderRadius: 6, cursor: "pointer",
                }}>{p}</button>
              ))}
            </div>
          </div>
          <div className="row gap-4" style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
            <div className="col gap-1">
              <div className="display tabular" style={{ fontSize: 44, color: "var(--teal-ink)" }}>47</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>apps sent · ↑ 23%</div>
            </div>
            <div style={{ flex: 1, maxWidth: 320 }}>
              <SparkBar data={[3,5,4,7,6,8,5,9,11,8,12,10,14,11]} tone="teal"/>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20, background: "var(--pink-soft)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h3>Top matches today</h3>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>by graph similarity</div>
            </div>
            <button className="btn btn-icon"><Icon name="trending" size={14}/></button>
          </div>
          <div className="col gap-2">
            {recent.map(l => (
              <div key={l.id} className="row gap-3" style={{
                padding: 10, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10,
              }}>
                <CompanyMark tone={l.tone} mark={l.mark} size={32}/>
                <div className="col" style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{l.title}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{l.company} · {l.platform}</div>
                </div>
                <div className="display tabular" style={{ fontSize: 18, color: `var(--${l.tone}-ink)` }}>{l.match}<span style={{ fontSize: 11, opacity: 0.6 }}>%</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live ticker */}
      <div className="card" style={{ padding: 18, background: "var(--yellow-soft)" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <div className="row gap-2">
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--yellow)", color: "var(--yellow-ink)", display: "grid", placeItems: "center" }}>
              <Icon name="clock" size={13}/>
            </div>
            <h3>Recent agent events</h3>
          </div>
          <button className="btn btn-ghost" onClick={() => setView("activity")} style={{ fontSize: 12 }}>See all <Icon name="arrow-right" size={12}/></button>
        </div>
        <div className="col gap-1" style={{ fontSize: 12 }}>
          {terminal.slice(-5).reverse().map((ln, i) => {
            const tone = { info: "blue", ok: "green", warn: "yellow", err: "pink" }[ln.lvl];
            return (
              <div key={i} className="row gap-3" style={{ padding: "7px 10px", borderRadius: 8, background: i === 0 ? "var(--card)" : "transparent" }}>
                <span className="mono tabular" style={{ fontSize: 10, color: "var(--ink-3)", minWidth: 50 }}>{(i+1)*8}s ago</span>
                <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: `var(--${tone})`, color: `var(--${tone}-ink)`, textTransform: "uppercase", letterSpacing: "0.08em" }}>{ln.lvl}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{ln.t}</span>
                <span style={{ fontSize: 12, flex: 1, color: "var(--ink-2)" }}>{ln.m}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

window.DashboardView = DashboardView;
