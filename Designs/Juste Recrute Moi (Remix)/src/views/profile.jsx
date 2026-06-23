// Profile — ingestion zone
const ProfileView = () => {
  const [over, setOver] = React.useState(false);
  const [ingested, setIngested] = React.useState(true);
  const [filename, setFilename] = React.useState("alex_chen_resume_v4.pdf");

  return (
    <div className="scroll" style={{ padding: 24, flex: 1 }}>
      {/* Header banner */}
      <div className="card" style={{ padding: "26px 28px", marginBottom: 18, background: "var(--pink-soft)" }}>
        <div className="row gap-6" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <div style={{
            width: 84, height: 84, borderRadius: 20,
            background: "var(--pink)", color: "var(--pink-ink)",
            display: "grid", placeItems: "center",
            fontFamily: "var(--font-display)", fontSize: 40,
            border: "1px solid var(--pink-ink)",
          }}>A</div>
          <div className="col gap-1" style={{ flex: 1 }}>
            <span className="eyebrow">The brain</span>
            <h1 style={{ fontSize: 44 }}>Alex Chen <span className="italic-serif" style={{ color: "var(--ink-2)" }}>· senior eng</span></h1>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>San Francisco · 7 years experience · graph last synced 4 minutes ago</div>
          </div>
          <div className="col gap-1" style={{ alignItems: "flex-end" }}>
            <span className="pill" style={{ background: "var(--green)", color: "var(--green-ink)" }}>
              <span className="dot pulse-soft"/> Ingested
            </span>
            <button className="btn" style={{ marginTop: 8 }}><Icon name="upload" size={13}/> Re-upload</button>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={"dropzone " + (over ? "over" : "")}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); setIngested(true); if (e.dataTransfer.files[0]) setFilename(e.dataTransfer.files[0].name); }}
        style={{ padding: "44px 32px", marginBottom: 18, textAlign: "center" }}
      >
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: "var(--purple)", color: "var(--purple-ink)",
          display: "grid", placeItems: "center", margin: "0 auto 18px",
          border: "1px solid var(--purple-ink)",
        }}>
          <Icon name="upload" size={28} stroke={1.6}/>
        </div>
        <h2 style={{ marginBottom: 6 }}>Drop your résumé <span className="italic-serif" style={{ color: "var(--ink-3)" }}>here</span></h2>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 16, maxWidth: 480, margin: "0 auto 16px" }}>
          We extract skills, projects, and experiences locally — your data never leaves your machine. Supports PDF, DOCX, Markdown.
        </div>
        <div className="row" style={{ justifyContent: "center", gap: 8 }}>
          <button className="btn btn-primary"><Icon name="file" size={13}/> Choose file</button>
          <button className="btn">Paste from clipboard</button>
        </div>
        {ingested && (
          <div className="row gap-2" style={{ justifyContent: "center", marginTop: 18, fontSize: 12 }}>
            <Icon name="file" size={13} color="var(--accent)"/>
            <span className="mono" style={{ color: "var(--ink-2)" }}>{filename}</span>
            <span className="pill" style={{ background: "var(--green)", color: "var(--green-ink)" }}><Icon name="check" size={10}/> parsed</span>
          </div>
        )}
      </div>

      {/* Two-up: skills + experience */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card" style={{ padding: 20, background: "var(--blue-soft)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h3>Skills <span className="italic-serif" style={{ color: "var(--ink-3)", fontFamily: "var(--font-display)", fontSize: 15 }}>· extracted</span></h3>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>{SKILLS.length} nodes · graph linked</div>
            </div>
            <button className="btn btn-icon"><Icon name="plus" size={13}/></button>
          </div>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            {SKILLS.map(s => (
              <div key={s.name} className="row gap-2" style={{
                padding: "6px 12px", borderRadius: 999,
                background: `var(--${s.tone})`, color: `var(--${s.tone}-ink)`,
                fontSize: 12, fontWeight: 500,
                border: `1px solid var(--${s.tone}-ink)`,
              }}>
                <span>{s.name}</span>
                <span className="mono tabular" style={{ fontSize: 10, opacity: 0.7 }}>{s.years}y</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20, background: "var(--orange-soft)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h3>Experience</h3>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>{EXPERIENCES.length} roles</div>
            </div>
          </div>
          <div className="col gap-2">
            {EXPERIENCES.map((e, i) => (
              <div key={i} className="row gap-3" style={{
                padding: 12, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `var(--${e.tone})`, color: `var(--${e.tone}-ink)`, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 18, border: `1px solid var(--${e.tone}-ink)` }}>{e.company[0]}</div>
                <div className="col" style={{ flex: 1, gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.role}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{e.company}</div>
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{e.period}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="card" style={{ padding: 20, background: "var(--green-soft)" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h3>Projects</h3>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>{PROJECTS.length} indexed</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {PROJECTS.map((p, i) => (
            <div key={i} style={{
              padding: 14, borderRadius: 12,
              background: `var(--${p.tone}-soft)`,
              border: `1px solid var(--${p.tone})`,
            }}>
              <div className="mono" style={{ fontSize: 10, color: `var(--${p.tone}-ink)`, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>{p.year}</div>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{p.company}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
window.ProfileView = ProfileView;
